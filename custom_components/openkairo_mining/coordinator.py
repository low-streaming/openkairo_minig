"""OpenKairo Mining DataUpdateCoordinator - modeled after hass-miner."""
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
        "hashrate": None,
        "ideal_hashrate": None,
        "temperature": None,
        "power_limit": None,
        "miner_consumption": None,
        "efficiency": None,
    },
    "board_sensors": {},
    "fan_sensors": {},
}


class MinerDataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching Miner data from an ASIC - hass-miner compatible."""

    miner_obj = None
    miner_ip: str = None
    miner_name: str = None
    _failure_count: int = 0

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, miner_ip: str, name: str):
        """Initialize the coordinator."""
        super().__init__(
            hass=hass,
            logger=_LOGGER,
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
        return self.miner_obj is not None and self.data is not None

    async def _get_miner(self):
        """Get or refresh the miner object."""
        import pyasic

        if self.miner_obj is not None:
            return self.miner_obj

        try:
            miner = await asyncio.wait_for(pyasic.get_miner(self.miner_ip), timeout=15)
        except (asyncio.TimeoutError, Exception) as e:
            _LOGGER.debug(f"[{self.miner_ip}] get_miner failed: {e}")
            return None

        if miner is None:
            # Fallback to BOS miner
            try:
                from pyasic.miners.backends.braiins_os import BOSMiner
                miner = BOSMiner(self.miner_ip)
            except Exception:
                return None

        # Apply credentials from config entry
        entry = self.config_entry
        if entry:
            pwd = entry.data.get("password", "")
            user = entry.data.get("username", "root")
            ssh_user = entry.data.get("ssh_username", "root")
            ssh_pwd = entry.data.get("ssh_password", "")

            if miner.api is not None and pwd:
                miner.api.pwd = pwd
            if miner.web is not None:
                try:
                    miner.web.username = user
                    miner.web.pwd = pwd
                except Exception:
                    pass
            if miner.ssh is not None:
                try:
                    miner.ssh.username = ssh_user
                    miner.ssh.pwd = ssh_pwd
                except Exception:
                    pass

        # Store static info
        try:
            self.miner_obj = miner
            # Store model/make for device_info
            self.miner_model = getattr(miner, "model", None)
            self.miner_make = getattr(miner, "make", None)
        except Exception:
            pass

        return self.miner_obj

    async def _async_update_data(self):
        """Fetch data from the ASIC - mirrors hass-miner strategy."""
        import pyasic

        miner = await self._get_miner()

        if miner is None:
            self._failure_count += 1
            self.miner_obj = None
            if self._failure_count == 1:
                _LOGGER.info(f"[{self.miner_ip}] Miner offline – returning default data")
                return {**DEFAULT_DATA, "ip": self.miner_ip}
            raise UpdateFailed(f"[{self.miner_ip}] Miner not reachable")

        # Request specific data fields for performance
        data_options = [
            pyasic.DataOptions.IS_MINING,
            pyasic.DataOptions.HASHRATE,
            pyasic.DataOptions.EXPECTED_HASHRATE,
            pyasic.DataOptions.HASHBOARDS,
            pyasic.DataOptions.WATTAGE,
            pyasic.DataOptions.WATTAGE_LIMIT,
            pyasic.DataOptions.FANS,
            pyasic.DataOptions.HOSTNAME,
        ]

        try:
            miner_data = await asyncio.wait_for(
                miner.get_data(include=data_options), timeout=20
            )
        except Exception as e:
            _LOGGER.warning(f"[{self.miner_ip}] Data fetch failed: {e}")
            self._failure_count += 1
            self.miner_obj = None
            if self._failure_count == 1:
                return {**DEFAULT_DATA, "ip": self.miner_ip}
            raise UpdateFailed(f"Miner data error: {e}") from e

        # Success
        self._failure_count = 0

        # Normalize hashrate to TH/s
        try:
            raw_hr = float(miner_data.hashrate or 0)
            if raw_hr > 1_000_000:
                hashrate = round(raw_hr / 1e12, 2)
            elif raw_hr > 500:
                hashrate = round(raw_hr / 1000, 2)
            else:
                hashrate = round(raw_hr, 2)
        except (TypeError, ValueError):
            hashrate = None

        try:
            ideal_hashrate = round(float(miner_data.expected_hashrate or 0), 2)
        except (TypeError, ValueError):
            ideal_hashrate = None

        # Build structured data dict
        board_sensors = {}
        try:
            for board in (miner_data.hashboards or []):
                slot = getattr(board, "slot", None)
                if slot is not None:
                    board_sensors[slot] = {
                        "board_temperature": getattr(board, "temp", None),
                        "chip_temperature": getattr(board, "chip_temp", None),
                        "board_hashrate": round(float(getattr(board, "hashrate", 0) or 0), 2),
                    }
        except Exception:
            pass

        fan_sensors = {}
        try:
            for idx, fan in enumerate(miner_data.fans or []):
                fan_sensors[idx] = {
                    "fan_speed": getattr(fan, "speed", None)
                }
        except Exception:
            pass

        return {
            "hostname": getattr(miner_data, "hostname", None),
            "mac": getattr(miner_data, "mac", None),
            "make": getattr(miner_data, "make", getattr(miner, "make", None)),
            "model": getattr(miner_data, "model", getattr(miner, "model", None)),
            "ip": self.miner_ip,
            "is_mining": getattr(miner_data, "is_mining", False),
            "fw_ver": getattr(miner_data, "fw_ver", None),
            "miner_sensors": {
                "hashrate": hashrate,
                "ideal_hashrate": ideal_hashrate,
                "temperature": getattr(miner_data, "temperature_avg", None),
                "power_limit": getattr(miner_data, "wattage_limit", None),
                "miner_consumption": getattr(miner_data, "wattage", None),
                "efficiency": getattr(miner_data, "efficiency", None),
            },
            "board_sensors": board_sensors,
            "fan_sensors": fan_sensors,
        }


async def async_get_miner_coordinator(
    hass, domain, miner_ip, miner_name, user="root", password="", ssh_user="root", ssh_password=""
):
    """Retrieve or create a coordinator for a specific miner."""
    coordinators = hass.data[domain].setdefault("coordinators", {})

    if miner_ip not in coordinators:
        # Try to find the config entry for this IP
        entry = None
        for e in hass.config_entries.async_entries(domain):
            if e.data.get("ip_address") == miner_ip:
                entry = e
                break

        coordinator = MinerDataUpdateCoordinator(hass, entry, miner_ip, miner_name)
        coordinators[miner_ip] = coordinator
        try:
            await coordinator.async_config_entry_first_refresh()
        except Exception:
            pass

    return coordinators[miner_ip]
