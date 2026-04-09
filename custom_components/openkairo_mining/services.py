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
        ip_address = call.data.get("ip_address")
        # Logic to find miner by ip_address and call reboot
        _LOGGER.info(f"Rebooting device {ip_address}")

    async def handle_restart_backend(call):
        ip_address = call.data.get("ip_address")
        _LOGGER.info(f"Restarting backend for device {ip_address}")

    hass.services.async_register(DOMAIN, SERVICE_REBOOT, handle_reboot, schema=SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_RESTART_BACKEND, handle_restart_backend, schema=SERVICE_SCHEMA)
