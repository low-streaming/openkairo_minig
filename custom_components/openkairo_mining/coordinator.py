import logging
import asyncio
from datetime import timedelta

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.core import HomeAssistant
from .const import DOMAIN, DEFAULT_UPDATE_INTERVAL

_LOGGER = logging.getLogger(__name__)

class MinerDataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching Miner data from an ASIC."""

    def __init__(self, hass: HomeAssistant, miner_ip: str, name: str, user: str = "root", password: str = "", ssh_user: str = "root", ssh_password: str = ""):
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
        self.ssh_user = ssh_user
        self.ssh_password = ssh_password
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
                self.miner_obj = await asyncio.wait_for(pyasic.get_miner(self.miner_ip), timeout=15)
                
                # Manual credential fallback for Braiins OS if get_miner is still struggling
                if self.miner_obj is None:
                    from pyasic.miners.backends.braiins_os import BOSMiner
                    self.miner_obj = BOSMiner(self.miner_ip)

                if self.miner_obj:
                    # Manual credential assignment
                    if self.miner_password:
                        self.miner_obj.api.pwd = self.miner_password
                        try:
                            self.miner_obj.web.username = self.miner_user or "root"
                            self.miner_obj.web.pwd = self.miner_password
                        except Exception:
                            pass
                    
                    if self.ssh_password:
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

            # Replicate hass-miner strategy: Fetch data with a robust timeout
            try:
                # BOSMiner and others work best with standard get_data()
                data = await asyncio.wait_for(self.miner_obj.get_data(), timeout=20)
                if not data:
                     raise UpdateFailed("Miner lieferte leere Daten.")
                
                # Normalize Hashrate (Industry Standard: always TH/s)
                raw_hashrate = getattr(data, "hashrate", 0) or 0
                try:
                    numeric_hashrate = float(raw_hashrate)
                    if numeric_hashrate > 1000000: # Clearly H/s
                        data.hashrate = round(numeric_hashrate / 1000000000000, 2)
                    elif numeric_hashrate > 500: # Likely GH/s (unlikely for S9 but possible for others)
                        data.hashrate = round(numeric_hashrate / 1000, 2)
                except (ValueError, TypeError):
                    pass

                return data
            except (asyncio.TimeoutError, Exception) as e:
                # Silently fail if it's just a timeout/offline issue to keep logs clean
                msg = str(e)
                if "LUCI" in msg or "Connection" in msg or "timeout" in msg.lower():
                    _LOGGER.info(f"[{self.miner_ip}] Miner ist offline oder beschäftigt: {msg}")
                else:
                    _LOGGER.warning(f"[{self.miner_ip}] Datenabruf fehlgeschlagen: {e}")
                
                self.miner_obj = None
                raise UpdateFailed(f"Miner offline: {e}")

        except Exception as err:
            # We don't log this as error to keep the system log clean when devices are off
            _LOGGER.debug(f"[{self.miner_ip}] Globaler Update-Info: {err}")
            self.miner_obj = None
            raise UpdateFailed(f"Offline: {err}")

async def async_get_miner_coordinator(hass, domain, miner_ip, miner_name, user="root", password="", ssh_user="root", ssh_password=""):
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
