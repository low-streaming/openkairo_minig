import logging
import asyncio
from datetime import timedelta

import pyasic
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

class MinerDataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching Miner data from an ASIC."""

    def __init__(self, hass: HomeAssistant, miner_ip: str, name: str, user: str = None, password: str = None, ssh_user: str = None, ssh_password: str = None):
        """Initialize the coordinator."""
        self.miner_ip = miner_ip
        self.miner_name = name
        self.miner_user = user
        self.miner_password = password
        self.ssh_user = ssh_user
        self.ssh_password = ssh_password
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
                _LOGGER.info(f"[{self.miner_name}] Searching for miner at {self.miner_ip}...")
                self.miner_obj = await pyasic.get_miner(self.miner_ip)
                if self.miner_obj and self.miner_password:
                    # Setze Anmeldedaten falls vorhanden
                    self.miner_obj.username = self.miner_user or "root"
                    self.miner_obj.pwd = self.miner_password
                if self.miner_obj and self.ssh_password:
                    try:
                        self.miner_obj.ssh_username = self.ssh_user or "root"
                        self.miner_obj.ssh_pwd = self.ssh_password
                    except Exception:
                        pass
            
            if self.miner_obj is None:
                _LOGGER.error(f"[{self.miner_name}] Miner not found at {self.miner_ip}!")
                raise UpdateFailed(f"Could not find miner at {self.miner_ip}")

            _LOGGER.debug(f"[{self.miner_name}] Fetching data...")
            # Fetch basic data
            data = await self.miner_obj.get_data()
            _LOGGER.debug(f"[{self.miner_name}] Data received: {data.hashrate if data else 'None'} TH/s")
            
            # Additional logic: can the miner be reached?
            if not data:
                raise UpdateFailed(f"Miner at {self.miner_ip} returned no data")
                
            return data
        except Exception as err:
            _LOGGER.debug(f"[{self.miner_name}] Detailed error: {err}")
            raise UpdateFailed(f"Communication error with miner at {self.miner_ip}: {err}")

async def async_get_miner_coordinator(hass, domain, miner_ip, miner_name, user=None, password=None, ssh_user=None, ssh_password=None):
    """Retrieve or create a coordinator for a specific miner."""
    coordinators = hass.data[domain].get("coordinators", {})
    
    if miner_ip not in coordinators:
        coordinator = MinerDataUpdateCoordinator(hass, miner_ip, miner_name, user, password, ssh_user, ssh_password)
        coordinators[miner_ip] = coordinator
        # Initially try to fetch data, but don't block too long
        try:
            await coordinator.async_config_entry_first_refresh()
        except Exception:
            pass
            
    return coordinators[miner_ip]
