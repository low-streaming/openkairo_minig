"""OpenKairo Mining DataUpdateCoordinator - Final Stabilization."""
import logging
import asyncio
from datetime import timedelta

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.helpers.debounce import Debouncer
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from .const import DOMAIN, DEFAULT_UPDATE_INTERVAL

_LOGGER = logging.getLogger(__name__)

REQUEST_REFRESH_DEFAULT_COOLDOWN = 5

DEFAULT_DATA = {
    "hostname": None,
    "mac": None,
    "make": None,
    "model": None,
    "ip": None,
    "is_mining": False,
    "fw_ver": None,
    "miner_sensors": {
        "hashrate": 0,
        "ideal_hashrate": 0,
        "temperature": 0,
        "power_limit": 0,
        "miner_consumption": 0,
        "efficiency": 0.0,
        "uptime": 0,
        "mode": "normal",
        "fault": False,
    },
    "board_sensors": {},
    "fan_sensors": {},
}


class MinerDataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching Miner data from an ASIC."""

    miner_obj = None
    miner_ip: str = None
    miner_name: str = None
    _failure_count: int = 0
    miner_model: str = None
    miner_make: str = None

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, miner_ip: str, name: str):
        """Initialize the coordinator."""
        super().__init__(
            hass=hass,
            logger=logging.getLogger(f"{__name__}.{miner_ip}"),
            config_entry=entry,
            name=name,
            update_interval=timedelta(seconds=DEFAULT_UPDATE_INTERVAL),
            request_refresh_debouncer=Debouncer(
                hass,
                _LOGGER,
                cooldown=REQUEST_REFRESH_DEFAULT_COOLDOWN,
                immediate=True,
            ),
        )
        self.miner_ip = miner_ip
        self.miner_name = name

    @property
    def available(self):
        """Return if device is available."""
        return self.data is not None and self._failure_count <= 3

    async def _get_miner(self):
        """Get or refresh the miner object."""
        import pyasic

        if self.miner_obj is not None:
            return self.miner_obj

        try:
            miner = await asyncio.wait_for(pyasic.get_miner(self.miner_ip), timeout=10)
            if miner:
                self.miner_obj = miner
                self.miner_model = getattr(miner, "model", "ASIC Miner")
                self.miner_make = getattr(miner, "make", "OpenKairo")
                
                entry = self.config_entry
                if entry:
                    pwd = entry.data.get("password")
                    user = entry.data.get("username", "root")
                    if miner.api and pwd: miner.api.pwd = pwd
                    if miner.web:
                        miner.web.username = user
                        miner.web.pwd = pwd or ""
                    if miner.ssh:
                        miner.ssh.username = entry.data.get("ssh_username", "root")
                        miner.ssh.pwd = entry.data.get("ssh_password") or ""
            return self.miner_obj
        except Exception as e:
            _LOGGER.debug(f"[{self.miner_ip}] Miner connection failed: {e}")
            return None

    async def _async_update_data(self):
        """Fetch data from the ASIC."""
        import pyasic
        import asyncio
        
        miner = await self._get_miner()

        if miner is None:
            self._failure_count += 1
            if self._failure_count <= 2:
                return {**DEFAULT_DATA, "ip": self.miner_ip}
            raise UpdateFailed(f"Miner at {self.miner_ip} unreachable.")

        data_options = [
            pyasic.DataOptions.IS_MINING,
            pyasic.DataOptions.HASHRATE,
            pyasic.DataOptions.EXPECTED_HASHRATE,
            pyasic.DataOptions.HASHBOARDS,
            pyasic.DataOptions.WATTAGE,
            pyasic.DataOptions.WATTAGE_LIMIT,
            pyasic.DataOptions.FANS,
            pyasic.DataOptions.HOSTNAME,
            pyasic.DataOptions.MAC,
            pyasic.DataOptions.FW_VERSION,
            pyasic.DataOptions.UPTIME,
        ]

        try:
            miner_data = await asyncio.wait_for(miner.get_data(include=data_options), timeout=25)
            self._failure_count = 0 
            
            # [FIX] Hashrate Scaling for BOS+
            # pyasic's hashrate is usually TH/s for modern backends.
            # If it's a huge number (> 1.000.000), it's H/s.
            # Otherwise, keep it as it is (it's likely TH/s).
            raw_hr = float(getattr(miner_data, "hashrate", 0) or 0)
            if raw_hr > 1000000: 
                 hr = round(raw_hr / 1e12, 2)
            else:
                 hr = round(raw_hr, 2)

            raw_exp = float(getattr(miner_data, "expected_hashrate", 0) or 0)
            if raw_exp > 1000000: exp_hr = round(raw_exp / 1e12, 2)
            else: exp_hr = round(raw_exp, 2)
            
            # [FIX] Efficiency Fallback
            wattage = float(getattr(miner_data, "wattage", 0) or 0)
            efficiency = getattr(miner_data, "efficiency", 0) or getattr(miner_data, "efficiency_fract", 0)
            if (not efficiency or efficiency == 0) and hr > 0:
                 efficiency = round(wattage / hr, 1)

            # Build Board/Fan Maps
            board_sensors = {}
            for board in getattr(miner_data, "hashboards", []):
                slot = getattr(board, "slot", -1)
                if slot != -1:
                    board_sensors[slot] = {
                        "board_temperature": getattr(board, "temp", 0),
                        "chip_temperature": getattr(board, "chip_temp", 0),
                        "board_hashrate": round(float(getattr(board, "hashrate", 0) or 0), 2),
                    }
            
            fan_sensors = {}
            for idx, fan in enumerate(getattr(miner_data, "fans", [])):
                fan_sensors[idx] = {
                    "fan_speed": getattr(fan, "speed", 0) or getattr(fan, "rpm", 0)
                }

            return {
                "hostname": getattr(miner_data, "hostname", self.miner_name),
                "mac": getattr(miner_data, "mac", None),
                "make": getattr(miner_data, "make", self.miner_make),
                "model": getattr(miner_data, "model", self.miner_model),
                "ip": self.miner_ip,
                "is_mining": getattr(miner_data, "is_mining", False),
                "fw_ver": getattr(miner_data, "fw_ver", None),
                "miner_sensors": {
                    "hashrate": hr,
                    "ideal_hashrate": exp_hr,
                    "temperature": getattr(miner_data, "temperature_avg", 0),
                    "power_limit": getattr(miner_data, "wattage_limit", 0),
                    "miner_consumption": wattage,
                    "efficiency": efficiency,
                    "uptime": getattr(miner_data, "uptime", 0),
                    "mode": getattr(miner_data, "mode", "normal"),
                    "fault": any(not getattr(b, "expected_chips", 0) == getattr(b, "chips", 0) for b in getattr(miner_data, "hashboards", [])),
                },
                "board_sensors": board_sensors,
                "fan_sensors": fan_sensors,
            }

        except Exception as e:
            _LOGGER.error(f"[{self.miner_ip}] Data collection failed: {e}")
            self.miner_obj = None # Try rediscover
            self._failure_count += 1
            if self._failure_count <= 2:
                return {**DEFAULT_DATA, "ip": self.miner_ip}
            raise UpdateFailed(f"Miner error: {e}")


async def async_get_miner_coordinator(hass, domain, miner_ip, miner_name, user="root", password="", ssh_user="root", ssh_password=""):
    """Fetch or create coordinator."""
    coordinators = hass.data[domain].setdefault("coordinators", {})
    if miner_ip not in coordinators:
        entry = next((e for e in hass.config_entries.async_entries(domain) if e.data.get("ip_address") == miner_ip), None)
        coordinators[miner_ip] = MinerDataUpdateCoordinator(hass, entry, miner_ip, miner_name)
        try:
            await coordinators[miner_ip].async_config_entry_first_refresh()
        except: pass
    return coordinators[miner_ip]
