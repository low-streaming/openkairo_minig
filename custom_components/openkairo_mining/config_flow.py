import logging
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult
from homeassistant.exceptions import HomeAssistantError

import pyasic

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
    ip_address = data["ip_address"]
    username = data.get("username", "root")
    password = data.get("password", "")
    ssh_username = data.get("ssh_username", "root")
    ssh_password = data.get("ssh_password", "")

    try:
        miner = await pyasic.get_miner(ip_address)
        if miner is None:
            raise CannotConnect("Kein ASIC Miner unter dieser IP-Adresse gefunden.")

        if password:
            miner.username = username
            miner.pwd = password
            
        if ssh_password:
            try:
                miner.ssh_username = ssh_username
                miner.ssh_pwd = ssh_password
            except Exception:
                pass

        # Versuche Daten abzurufen, um Login zu testen
        miner_data = await miner.get_data()
        if not miner_data:
            raise InvalidAuth("Login fehlgeschlagen oder Miner liefert keine Daten.")
            
        model = miner.make or "ASIC"
        
        return {"title": f"{model} ({ip_address})", "model": model}

    except Exception as err:
        _LOGGER.error("Fehler beim Verbinden mit ASIC am %s: %s", ip_address, err)
        raise CannotConnect(f"Verbindungsfehler: {err}")


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
