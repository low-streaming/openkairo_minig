import asyncio
import logging
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required("ip_address"): str,
        vol.Optional("username", default="root"): str,
        vol.Optional("password", default=""): str,
        vol.Optional("ssh_username", default="root"): str,
        vol.Optional("ssh_password", default=""): str,
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
            # Replicate hass-miner: Simple get_miner without constructor credentials
            miner = await pyasic.get_miner(ip_address)
            if miner:
                _LOGGER.info(f"[{ip_address}] Miner erkannt: {miner.make} ({miner.model})")
                break
        except Exception as e:
            _LOGGER.warning(f"[{ip_address}] Verbindungsversuch {attempt + 1} fehlgeschlagen: {e}")
        
        if attempt < max_retries - 1:
            await asyncio.sleep(retry_delay)

    # Fallback für Braiins OS (BOSMiner) falls get_miner fehlschlägt
    if miner is None:
        _LOGGER.info(f"[{ip_address}] Automatische Suche fehlgeschlagen. Versuche Direkt-Verbindung für Braiins OS...")
        try:
            from pyasic.miners.backends.braiins_os import BOSMiner
            miner = BOSMiner(ip_address)
            # Basic check if it responds
            data_test = await asyncio.wait_for(miner.get_data(), timeout=10)
            if not data_test:
                miner = None
        except Exception as e:
            _LOGGER.debug(f"[{ip_address}] BOS-Fallback fehlgeschlagen: {e}")
            miner = None

    if miner is None:
        _LOGGER.error(f"[{ip_address}] Kein ASIC Miner nach {max_retries} Versuchen gefunden.")
        raise CannotConnect(
            f"Kein ASIC Miner unter {ip_address} gefunden. "
            "Bitte stelle sicher, dass der API-Port (4028) am Miner aktiviert ist. "
        )

    try:
        # Replicate hass-miner: Manual assignment of credentials
        if password:
            miner.api.pwd = password
            # Some miners use web auth too
            try:
                miner.web.username = username
                miner.web.pwd = password
            except Exception:
                pass
            
        if ssh_password:
            try:
                miner.ssh_username = ssh_username
                miner.ssh_pwd = ssh_password
            except Exception:
                pass

        # Versuche Daten abzurufen, um Login zu testen
        _LOGGER.debug(f"[{ip_address}] Teste Login/Datenabruf...")
        miner_data = await asyncio.wait_for(miner.get_data(), timeout=15)
        if not miner_data:
            raise InvalidAuth("Login fehlgeschlagen oder Miner liefert keine Daten.")
            
        model = miner.model or "ASIC"
        return {"title": f"{model} ({ip_address})", "model": model}

    except InvalidAuth:
        raise
    except Exception as err:
        _LOGGER.error("Fehler beim Datenabruf von ASIC am %s: %s", ip_address, err)
        raise CannotConnect(f"Verbindungsfehler während Datenabruf: {err}")


class OpenKairoMiningConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for OpenKairo Mining."""

    VERSION = 1

    async def async_step_user(self, user_input=None) -> FlowResult:
        """Handle the initial step."""
        
        errors: dict[str, str] = {}
        
        if not self._async_current_entries():
            # First setup: we just create the "Zentrale" entry for the Dashboard.
            # No ASIC config needed for the very first entry.
            return self.async_create_entry(title="OpenKairo Dashboard", data={})

        if user_input is not None:
            # Check if this IP is already configured
            await self.async_set_unique_id(user_input["ip_address"])
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
            step_id="user", data_schema=STEP_USER_DATA_SCHEMA, errors=errors
        )

class CannotConnect(HomeAssistantError):
    """Error to indicate we cannot connect."""

class InvalidAuth(HomeAssistantError):
    """Error to indicate there is invalid auth."""
