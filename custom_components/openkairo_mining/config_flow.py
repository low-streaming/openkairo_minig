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
        vol.Optional("api_token", default=""): str,
        vol.Optional("min_power", default=400): int,
        vol.Optional("max_power", default=1400): int,
    }
)

async def validate_input(hass: HomeAssistant, data: dict[str, str]) -> dict[str, str]:
    """Validate the user input allows us to connect."""
    import pyasic
    import aiohttp
    
    ip_address = data["ip_address"].strip()
    api_token = data.get("api_token", "").strip()
    
    _LOGGER.debug(f"[{ip_address}] Starte parallele Miner-Suche...")

    # Define the discovery tasks
    async def check_pbfarmer():
        endpoints = [
            f"https://{ip_address}/api/overview",    # New API (HTTPS)
            f"http://{ip_address}/api/overview",     # New API (HTTP)
            f"http://{ip_address}:4111/api/overview" # Legacy API
        ]
        timeout = aiohttp.ClientTimeout(total=8)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            for url in endpoints:
                try:
                    _LOGGER.debug(f"[{ip_address}] Probiere PBfarmer-Webhook: {url}")
                    headers = {}
                    if api_token:
                        headers["Authorization"] = f"Bearer {api_token}"
                    
                    async with session.get(url, ssl=False, headers=headers) as resp:
                        if resp.status == 200:
                            try:
                                json_data = await resp.json()
                                # ONLY match if it's really PBfarmer
                                if "PBfarmer" in str(json_data) or "softver" in str(json_data):
                                    _LOGGER.info(f"[{ip_address}] PBfarmer verifiziert via {url}")
                                    class MinerStub:
                                        def __init__(self, ip):
                                            self.ip = ip
                                            self._is_stub = True
                                            self.make = "IceRiver"
                                            self.model = "KS0 (PBfarmer)"
                                    
                                    miner = MinerStub(ip_address)
                                    if json_data.get("data", {}).get("model"):
                                        miner.model = f"{json_data['data']['model']} (PBfarmer)"
                                    return {"title": miner.model, "miner": miner}
                            except Exception: pass
                        elif resp.status in [401, 403]:
                            _LOGGER.info(f"[{ip_address}] PBfarmer vermutet (Auth Req) via {url}")
                            class MinerStub:
                                def __init__(self, ip):
                                    self.ip = ip
                                    self._is_stub = True
                                    self.make = "IceRiver"
                                    self.model = "KS0 (PBfarmer)"
                            miner = MinerStub(ip_address)
                            return {"title": miner.model, "miner": miner}
                except Exception as e:
                    _LOGGER.debug(f"[{ip_address}] Probe {url} fehlgeschlagen: {e}")
        return None

    async def check_pyasic_standard():
        try:
            # Shorter timeout for discovery, we can be more aggressive
            miner = await asyncio.wait_for(pyasic.get_miner(ip_address), timeout=10)
            if miner:
                _LOGGER.info(f"[{ip_address}] Standard pyasic Miner erkannt: {miner.make} ({miner.model})")
                return {"title": f"{miner.model} ({ip_address})", "miner": miner}
        except Exception as e:
            _LOGGER.debug(f"[{ip_address}] Standard-Discovery fehlgeschlagen: {e}")
        return None

    async def check_pyasic_port_4028():
        try:
            reader, writer = await asyncio.wait_for(asyncio.open_connection(ip_address, 4028), timeout=5)
            writer.write(b'{"command":"summary"}')
            await writer.drain()
            resp = await reader.read(4096)
            writer.close()
            await writer.wait_closed()
            if resp:
                from pyasic.miners.antminer.bm_miner.S19 import AntminerS19
                miner = AntminerS19(ip_address)
                return {"title": "Antminer/VNish (4028)", "miner": miner}
        except Exception: pass
        return None

    async def check_generic_http_api():
        # Check for Bitaxe / NerdMiner / ESP32 Generic API
        endpoints = [
            f"http://{ip_address}/api",
            f"http://{ip_address}/stats",
        ]
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            for url in endpoints:
                try:
                    async with session.get(url, ssl=False) as resp:
                        if resp.status == 200:
                            try:
                                json_data = await resp.json()
                                # Heuristic: If it has hashrate or shares, it's likely a miner
                                if "hashrate" in json_data or "shares" in json_data or "freq" in json_data:
                                    model = json_data.get("model", "NerdMiner/Bitaxe")
                                    if "bitaxe" in str(json_data).lower(): model = "Bitaxe"
                                    _LOGGER.info(f"[{ip_address}] Generic HTTP Miner ({model}) found via {url}")
                                    
                                    class GenericMinerStub:
                                        def __init__(self, ip, model):
                                            self.ip = ip
                                            self._is_stub = True
                                            self.make = "ESP32"
                                            self.model = model
                                            
                                    return {"title": f"{model} ({ip_address})", "miner": GenericMinerStub(ip_address, model)}
                            except Exception: pass
                except Exception: continue
        return None

    # Parallel Execution
    tasks = [
        asyncio.create_task(check_pbfarmer()),
        asyncio.create_task(check_generic_http_api()),
        asyncio.create_task(check_pyasic_standard()),
        asyncio.create_task(check_pyasic_port_4028())
    ]
    
    done, pending = await asyncio.wait(tasks, timeout=12, return_when=asyncio.FIRST_COMPLETED)
    
    result = None
    for t in done:
        result = t.result()
        if result: break
    
    if not result:
        # Fallback to wait for others if any
        for t in asyncio.as_completed(pending):
            result = await t
            if result: break
            
    for t in pending: t.cancel()

    if result:
        _LOGGER.info(f"[{ip_address}] Miner gefunden via: {result['title']}")
        return result

    raise CannotConnect(f"Kein Miner unter {ip_address} gefunden (Timeouts oder Port geschlossen).")


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
    
    @staticmethod
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> config_entries.OptionsFlow:
        """Get the options flow for this handler."""
        return OpenKairoMiningOptionsFlowHandler(config_entry)


class OpenKairoMiningOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for OpenKairo Mining."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(self, user_input: dict[str, any] | None = None) -> ConfigFlowResult:
        """Manage the options."""
        if user_input is not None:
            # Update the config entry with new data
            new_data = dict(self.config_entry.data)
            new_data.update(user_input)
            self.hass.config_entries.async_update_entry(self.config_entry, data=new_data)
            return self.async_create_entry(title="", data={})

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional("api_token", default=self.config_entry.data.get("api_token", "")): str,
                    vol.Optional("min_power", default=self.config_entry.data.get("min_power", 400)): int,
                    vol.Optional("max_power", default=self.config_entry.data.get("max_power", 1400)): int,
                    vol.Optional("username", default=self.config_entry.data.get("username", "root")): str,
                    vol.Optional("password", default=self.config_entry.data.get("password", "")): str,
                }
            ),
        )


class CannotConnect(HomeAssistantError):
    """Error to indicate we cannot connect."""

class InvalidAuth(HomeAssistantError):
    """Error to indicate there is invalid auth."""
