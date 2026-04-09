import logging
import asyncio
from datetime import timedelta

import pyasic
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

class MinerDataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching Miner data from an ASIC."""

    def __init__(self, hass: HomeAssistant, miner_ip: str, name: str):
        """Initialize the coordinator."""
        self.miner_ip = miner_ip
        self.miner_name = name
        self.miner_obj = None
        
        super().__init__(
            hass,
            _LOGGER,
            name=f"OpenKairo Miner {name} ({miner_ip})",
            update_interval=timedelta(seconds=15),
        )

    async def _async_update_data(self):
        """Fetch data from the miner."""
        try:
            if self.miner_obj is None:
                self.miner_obj = await pyasic.get_miner(self.miner_ip)
            
            if self.miner_obj is None:
                raise UpdateFailed(f"Could not find miner at {self.miner_ip}")

            # Fetch basic data
            data = await self.miner_obj.get_data()
            
            # Additional logic: can the miner be reached?
            if not data:
                raise UpdateFailed(f"Miner at {self.miner_ip} returned no data")
                
            return data
        except Exception as err:
            raise UpdateFailed(f"Error communicating with miner at {self.miner_ip}: {err}")

async def async_get_miner_coordinator(hass, domain, miner_ip, miner_name):
    """Retrieve or create a coordinator for a specific miner."""
    coordinators = hass.data[domain].get("coordinators", {})
    
    if miner_ip not in coordinators:
        coordinator = MinerDataUpdateCoordinator(hass, miner_ip, miner_name)
        coordinators[miner_ip] = coordinator
        # Initially try to fetch data, but don't block too long
        try:
            await coordinator.async_config_entry_first_refresh()
        except Exception:
            pass
            
    return coordinators[miner_ip]
