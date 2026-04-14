import asyncio
import logging
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
try:
    from homeassistant.config_entries import ConfigFlowResult
except ImportError:
    from homeassistant.data_entry_flow import FlowResult as ConfigFlowResult
from homeassistant.exceptions import HomeAssistantError
from homeassistant.components import network

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required("ip_address"): str,
        vol.Optional("username", default="root"): str,
        vol.Optional("password", default=""): str,
        vol.Optional("ssh_username", default="root"): str,
        vol.Optional("ssh_password", default=""): str,
        vol.Optional("min_power", default=400): int,
        vol.Optional("max_power", default=1400): int,
    }
)

async def validate_input(hass: HomeAssistant, data: dict[str, str]) -> dict[str, str]:
    """Validate the user input allows us to connect."""
    # Lazy import to avoid startup issues
    import pyasic
    
    # Clean up whitespace
    ip_address = data["ip_address"].strip()
    username = data.get("username", "root")
    password = data.get("password", "")
    ssh_username = data.get("ssh_username", "root")
    ssh_password = data.get("ssh_password", "")

    max_retries = 3
    retry_delay = 2
    miner = None

    for attempt in range(max_retries):
        try:
            _LOGGER.debug(f"[{ip_address}] Miner-Suche Versuch {attempt + 1}/{max_retries}...")
            # Increase timeout specifically for Avalon miners which can be slow on Wi-Fi
            miner = await asyncio.wait_for(pyasic.get_miner(ip_address), timeout=30)
            if miner:
                _LOGGER.info(f"[{ip_address}] Miner erkannt: {miner.make} ({miner.model})")
                break
        except Exception as e:
            _LOGGER.warning(f"[{ip_address}] Verbindungsversuch {attempt + 1} fehlgeschlagen: {e}")
        
        # No more hardcoded Braiins OS fallback here. 
        # get_miner() should be robust enough with pyasic >= 0.23.0

        if miner is None and attempt < max_retries - 1:
            await asyncio.sleep(retry_delay)

    if miner is None:
        _LOGGER.debug(f"[{ip_address}] Standard-Discovery fehlgeschlagen. Versuche robusten API-Check (Port 4028)...")
        try:
            # Versuche direkt die API auf 4028 anzufragen
            reader, writer = await asyncio.wait_for(asyncio.open_connection(ip_address, 4028), timeout=5)
            writer.write(b'{"command":"summary"}')
            await writer.drain()
            resp = await reader.read(4096)
            writer.close()
            await writer.wait_closed()
            
            if resp:
                _LOGGER.info(f"[{ip_address}] API antwortet auf 4028. Versuche VNish S21 Initialisierung...")
                # Wir versuchen den S21 VNish Typ zu erzwingen
                try:
                    from pyasic.miners.antminer import VNishS21
                    miner = VNishS21(ip_address)
                except ImportError:
                    # Fallback auf S19 falls VNishS21 nicht in dieser pyasic Version ist
                    from pyasic.miners.antminer.bm_miner.S19 import AntminerS19
                    miner = AntminerS19(ip_address)
        except Exception as e:
            _LOGGER.debug(f"[{ip_address}] Robuster API-Check fehlgeschlagen: {e}")

    if miner is None:
        _LOGGER.error(f"[{ip_address}] Kein ASIC Miner nach {max_retries} Versuchen gefunden.")
        raise CannotConnect(
            f"Kein ASIC Miner unter {ip_address} gefunden. "
            "Überprüfe die IP und stelle sicher, dass der Port 4028 oder 80 offen ist, "
            "und dass 'API Access' in VNish auf 'Open' oder 'Local' steht."
        )

    # Attempt data retrieval with different usernames (fallback probing)
    # If no password is provided, we prioritize an anonymous check
    if not password:
        usernames_to_try = [None, "admin", "root"]
    else:
        usernames_to_try = [username, "admin", "root"]
        
    # Filter duplicates and maintain order
    usernames_to_try = list(dict.fromkeys(usernames_to_try))

    last_error = None
    for trial_user in usernames_to_try:
        try:
            if trial_user is None:
                _LOGGER.debug(f"[{ip_address}] Versuche anonyme Validierung (ohne Login)...")
            else:
                _LOGGER.debug(f"[{ip_address}] Versuche Validierung mit Benutzer: {trial_user}...")
                
            if password:
                if hasattr(miner, "api") and miner.api:
                    miner.api.pwd = password
                if hasattr(miner, "web") and miner.web:
                    miner.web.pwd = password
            
            if trial_user and hasattr(miner, "web") and miner.web:
                miner.web.username = trial_user
                
            # [FIX] Lenient Data Retrieval
            _LOGGER.debug(f"[{ip_address}] Rufe Miner-Daten ab...")
            miner_data = None
            
            # 1. Try full get_data (might fail on 'config' endpoint)
            try:
                miner_data = await asyncio.wait_for(miner.get_data(), timeout=20)
            except Exception as e:
                _LOGGER.warning(f"[{ip_address}] Voller Datenabruf fehlgeschlagen: {e}. Versuche Light-Modus...")
                # 2. Try partial get_data (only summary/fans/temp - avoids 'config' endpoint)
                try:
                    import pyasic
                    minimal_options = [
                        pyasic.DataOptions.HASHRATE,
                        pyasic.DataOptions.WATTAGE,
                        pyasic.DataOptions.MAC,
                    ]
                    miner_data = await asyncio.wait_for(miner.get_data(include=minimal_options), timeout=20)
                except Exception as e2:
                    _LOGGER.error(f"[{ip_address}] Auch Light-Datenabruf fehlgeschlagen: {e2}")
            
            if not miner_data:
                # 3. Ultra-Fallback: Directly probe Port 4028
                _LOGGER.debug(f"[{ip_address}] Versuche direkten API-Zugriff auf Port 4028...")
                try:
                    if hasattr(miner, "api") and miner.api:
                        raw_summary = await miner.api.summary()
                        if raw_summary and "STATUS" in raw_summary:
                            _LOGGER.info(f"[{ip_address}] Direkter Port 4028 Zugriff erfolgreich!")
                            miner_data = True  # Mark as success to add the miner
                        else:
                            # Also try raw send_command since some pyasic versions map it differently
                            raw = await miner.api.send_command("summary")
                            if raw:
                                _LOGGER.info(f"[{ip_address}] Direkter command Zugriff erfolgreich!")
                                miner_data = True
                except Exception as e3:
                    _LOGGER.error(f"[{ip_address}] Direkter API-Zugriff fehlgeschlagen: {e3}")
            
            if miner_data:
                _LOGGER.info(f"[{ip_address}] Validierung erfolgreich (Benutzer: {trial_user})")
                model = miner.model or "ASIC"
                # Update data with the successful trial_user
                data["username"] = trial_user
                return {"title": f"{model} ({ip_address})", "model": model}

        except Exception as err:
            last_error = err
            _LOGGER.debug(f"[{ip_address}] Versuch mit {trial_user} fehlgeschlagen: {err}")
            continue

    # If we are here, everything failed
    _LOGGER.error(f"[{ip_address}] Alle Validierungsversuche fehlgeschlagen.")
    if "Anmeldung" in str(last_error) or "Unauthorized" in str(last_error):
        raise InvalidAuth(f"Anmeldung fehlgeschlagen (root/admin). Bitte Passwort prüfen.")
    raise CannotConnect(f"Miner gefunden, aber Datenzugriff verweigert: {last_error}")


class OpenKairoMiningConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for OpenKairo Mining."""

    VERSION = 1

    async def async_step_user(self, user_input=None) -> ConfigFlowResult:
        """Handle the initial step."""
        
        errors: dict[str, str] = {}
        
        if not self._async_current_entries():
            # First setup: we just create the "Zentrale" entry for the Dashboard.
            # No ASIC config needed for the very first entry.
            return self.async_create_entry(title="OpenKairo Dashboard", data={})

        # Suggest scanning first
        if user_input is None:
            return self.async_show_form(
                step_id="user",
                data_schema=vol.Schema({
                    vol.Optional("manual_entry", default=False): bool,
                }),
                description_placeholders={"info": "Scanner startet automatisch..."},
                errors=errors
            )
        
        if user_input.get("manual_entry"):
            return await self.async_step_manual()
            
        return await self.async_step_scan()

    async def async_step_manual(self, user_input=None) -> ConfigFlowResult:
        """Manual IP entry step."""
        errors = {}
        if user_input is not None:
            await self.async_set_unique_id(user_input["ip_address"], raise_on_progress=False)
            self._abort_if_unique_id_configured()
            try:
                info = await validate_input(self.hass, user_input)
                return self.async_create_entry(title=info["title"], data=user_input)
            except CannotConnect:
                errors["base"] = "cannot_connect"
            except InvalidAuth:
                errors["base"] = "invalid_auth"
            except Exception:
                _LOGGER.exception("Unexpected exception")
                errors["base"] = "unknown"

        return self.async_show_form(
            step_id="manual", data_schema=STEP_USER_DATA_SCHEMA, errors=errors
        )

    async def async_step_scan(self, user_input=None) -> ConfigFlowResult:
        """Scan network for miners."""
        if user_input is None:
            # Run scan
            miners = await self._async_scan_for_miners()
            self._found_miners = { str(m.ip): m for m in miners }
            
            if not miners:
                return self.async_show_form(
                    step_id="scan_failed",
                    errors={"base": "no_miners_found"}
                )

            options = { ip: f"{getattr(m, 'model', 'ASIC')} ({ip})" for ip, m in self._found_miners.items() }
            return self.async_show_form(
                step_id="discovery_select",
                data_schema=vol.Schema({
                    vol.Required("selected_miner"): vol.In(options),
                    vol.Optional("password", default=""): str,
                })
            )
        return await self.async_step_discovery_select(user_input)

    async def async_step_discovery_select(self, user_input=None) -> ConfigFlowResult:
        """Handle selection from discovery."""
        if user_input:
            ip = user_input["selected_miner"]
            password = user_input.get("password", "")
            
            # Pre-fill data for validation
            full_input = {
                "ip_address": ip,
                "password": password,
                "username": "root", # Default
            }
            
            try:
                info = await validate_input(self.hass, full_input)
                return self.async_create_entry(title=info["title"], data=full_input)
            except Exception as e:
                _LOGGER.error(f"Discovery selection failed for {ip}: {e}")
                return await self.async_step_manual({"ip_address": ip, "password": password})
                
        return await self.async_step_scan()

    async def _async_scan_for_miners(self):
        """Dynamic network scan helper."""
        import pyasic
        from pyasic.network import MinerNetwork
        
        discovery_results = []
        try:
            adapters = await network.async_get_adapters(self.hass)
            for adapter in adapters:
                for ip_info in adapter.get("ipv4", []):
                    # Skip loopback
                    if ip_info.get("address", "").startswith("127."): continue
                    
                    local_ip = ip_info["address"]
                    prefix = ip_info["network_prefix"]
                    
                    if not local_ip or not prefix: continue
                    
                    _LOGGER.debug(f"Scanning subnet: {local_ip}/{prefix}")
                    miner_net = MinerNetwork.from_subnet(f"{local_ip}/{prefix}")
                    # Parallel scan
                    found = await miner_net.scan()
                    if found:
                        discovery_results.extend(found)
        except Exception as e:
            _LOGGER.error(f"Network scan failed: {e}")
            
        return discovery_results

    async def async_step_scan_failed(self, user_input=None) -> ConfigFlowResult:
        """Handle case where no miners are found."""
        return await self.async_step_manual()

class CannotConnect(HomeAssistantError):
    """Error to indicate we cannot connect."""

class InvalidAuth(HomeAssistantError):
    """Error to indicate there is invalid auth."""
