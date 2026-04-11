import logging
import asyncio
from datetime import timedelta

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.core import HomeAssistant
from .const import DOMAIN, DEFAULT_UPDATE_INTERVAL

_LOGGER = logging.getLogger(__name__)

class MinerDataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching Miner data from an ASIC."""

    def __init__(self, hass: HomeAssistant, miner_ip: str, name: str, user: str = "root", password: str = ""):
        """Initialize the coordinator."""
        # Lazy import inside the class
        import pyasic
        
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=DEFAULT_UPDATE_INTERVAL),
        )
        self.miner_ip = miner_ip
        self.miner_name = name
        self.miner_user = user
        self.miner_password = password
        self.miner_obj = None
        self.miner_model = None
        self.miner_make = None

    async def _async_update_data(self):
        """Fetch data from the ASIC."""
        import pyasic
        import asyncio
        
        try:
            if self.miner_obj is None:
                # Replicate hass-miner: get_miner without credentials
                self.miner_obj = await pyasic.get_miner(self.miner_ip)
                if self.miner_obj:
                    # Manual credential assignment
                    if self.miner_password:
                        self.miner_obj.api.pwd = self.miner_password
                        try:
                            self.miner_obj.ssh_username = self.ssh_user or "root"
                            self.miner_obj.ssh_pwd = self.ssh_password
                        except Exception:
                            pass
                    
                    # Store static info
                    self.miner_model = self.miner_obj.model
                    self.miner_make = self.miner_obj.make
            
            if self.miner_obj is None:
                raise UpdateFailed(f"Miner an {self.miner_ip} nicht gefunden.")

            # Fetch basic data with timeout
            data = None
            try:
                # Add explicit timeout for slow responding miners
                data = await asyncio.wait_for(self.miner_obj.get_data(), timeout=15)
            except asyncio.TimeoutError:
                _LOGGER.warning(f"[{self.miner_ip}] Zeitüberschreitung beim Datenabruf.")
                self.miner_obj = None
                raise UpdateFailed(f"Zeitüberschreitung beim Miner an {self.miner_ip}")
            
            if not data:
                # If data is empty, we might need to rediscover
                self.miner_obj = None
                raise UpdateFailed(f"Miner an {self.miner_ip} lieferte keine Daten.")
                
            return data
        except Exception as err:
            _LOGGER.debug(f"[{self.miner_ip}] Verbindungsfehler: {err}")
            # Reset on connection errors
            if "Connection" in str(err) or "timeout" in str(err).lower():
                self.miner_obj = None
            raise UpdateFailed(f"Kommunikationsfehler: {err}")

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
