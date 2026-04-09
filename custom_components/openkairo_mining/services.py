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
        coordinator = hass.data[DOMAIN].get("coordinators", {}).get(ip_address)
        if coordinator and getattr(coordinator, "miner_obj", None):
            _LOGGER.info(f"Rebooting device {ip_address} natively via pyasic")
            try:
                await coordinator.miner_obj.reboot()
            except Exception as e:
                _LOGGER.error(f"Reboot failed: {e}")
        else:
            _LOGGER.error(f"Cannot found active coordinator for {ip_address}")

    async def handle_restart_backend(call):
        ip_address = call.data.get("ip_address")
        coordinator = hass.data[DOMAIN].get("coordinators", {}).get(ip_address)
        if coordinator and getattr(coordinator, "miner_obj", None):
            _LOGGER.info(f"Restarting backend for device {ip_address} natively via pyasic")
            try:
                await coordinator.miner_obj.restart_backend()
            except Exception as e:
                _LOGGER.error(f"Backend restart failed: {e}")
        else:
            _LOGGER.error(f"Cannot found active coordinator for {ip_address}")


    hass.services.async_register(DOMAIN, SERVICE_REBOOT, handle_reboot, schema=SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_RESTART_BACKEND, handle_restart_backend, schema=SERVICE_SCHEMA)
