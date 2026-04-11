import logging
import voluptuous as vol
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

SERVICE_REBOOT = "reboot"
SERVICE_RESTART = "restart"
SERVICE_STOP_MINING = "stop_mining"
SERVICE_RESUME_MINING = "resume_mining"
SERVICE_SET_POWER_LIMIT = "set_power_limit"

SERVICE_SCHEMA = vol.Schema({
    vol.Required("ip_address"): cv.string,
    vol.Optional("value"): vol.Coerce(int),
})

async def async_setup_services(hass):
    """Register services for the Miner integration."""
    
    async def get_coord(call):
        ip_address = call.data.get("ip_address")
        return hass.data[DOMAIN].get("coordinators", {}).get(ip_address)

    async def handle_reboot(call):
        coord = await get_coord(call)
        if coord and coord.miner_obj:
            try:
                await coord.miner_obj.reboot()
            except Exception as e:
                _LOGGER.error(f"Reboot failed: {e}")

    async def handle_restart(call):
        coord = await get_coord(call)
        if coord and coord.miner_obj:
            try:
                # pyasic handles different restart types depending on backend
                await coord.miner_obj.restart_backend()
            except Exception as e:
                _LOGGER.error(f"Restart failed: {e}")

    async def handle_stop_mining(call):
        coord = await get_coord(call)
        if coord and coord.miner_obj:
            try:
                await coord.miner_obj.stop_mining()
                await coord.async_request_refresh()
            except Exception as e:
                _LOGGER.error(f"Stop failed: {e}")

    async def handle_resume_mining(call):
        coord = await get_coord(call)
        if coord and coord.miner_obj:
            try:
                await coord.miner_obj.resume_mining()
                await coord.async_request_refresh()
            except Exception as e:
                _LOGGER.error(f"Resume failed: {e}")

    async def handle_set_power_limit(call):
        coord = await get_coord(call)
        value = call.data.get("value")
        if coord and coord.miner_obj and value:
            try:
                await coord.miner_obj.set_power_limit(int(value))
                await coord.async_request_refresh()
            except Exception as e:
                _LOGGER.error(f"Set Power Limit failed: {e}")

    hass.services.async_register(DOMAIN, SERVICE_REBOOT, handle_reboot, schema=SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_RESTART, handle_restart, schema=SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_STOP_MINING, handle_stop_mining, schema=SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_RESUME_MINING, handle_resume_mining, schema=SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_SET_POWER_LIMIT, handle_set_power_limit, schema=SERVICE_SCHEMA)
