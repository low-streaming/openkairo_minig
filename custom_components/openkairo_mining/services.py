import logging
import voluptuous as vol
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

SERVICE_REBOOT = "reboot"
SERVICE_RESTART_BACKEND = "restart_backend"

SERVICE_SCHEMA = vol.Schema({
    vol.Required("ip_address"): cv.string,
})

async def async_setup_services(hass):
    """Register services for the Miner integration."""
    
    async def handle_reboot(call):
        device_id = call.data.get("device_id")
        # Logic to find miner by device_id and call reboot
        _LOGGER.info(f"Rebooting device {device_id}")

    async def handle_restart_backend(call):
        device_id = call.data.get("device_id")
        _LOGGER.info(f"Restarting backend for device {device_id}")

    hass.services.async_register(DOMAIN, SERVICE_REBOOT, handle_reboot, schema=SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_RESTART_BACKEND, handle_restart_backend, schema=SERVICE_SCHEMA)
