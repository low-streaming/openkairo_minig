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
            
            if not miner:
                # Robust discovery fallback: try port 4028 directly
                try:
                    _LOGGER.debug(f"[{self.miner_ip}] Coordinator standard discovery failed. Attempting robust probe...")
                    reader, writer = await asyncio.wait_for(asyncio.open_connection(self.miner_ip, 4028), timeout=5)
                    writer.write(b'{"command":"summary"}')
                    await writer.drain()
                    resp = await reader.read(1024)
                    writer.close()
                    await writer.wait_closed()
                    
                    if resp:
                        try:
                            from pyasic.miners.antminer import VNishS21
                            miner = VNishS21(self.miner_ip)
                        except ImportError:
                            from pyasic.miners.antminer.bm_miner.S19 import AntminerS19
                            miner = AntminerS19(self.miner_ip)
                except Exception as e:
                    _LOGGER.debug(f"[{self.miner_ip}] Coordinator robust probe failed: {e}")

            if miner:
                self.miner_obj = miner
                self.miner_model = getattr(miner, "model", "ASIC Miner")
                self.miner_make = getattr(miner, "make", "OpenKairo")
                
                if entry:
                    pwd = entry.data.get("password")
                    user = entry.data.get("username", "root")
                    
                    if pwd:
                        if miner.api: miner.api.pwd = pwd
                        if miner.web: miner.web.pwd = pwd
                    
                    if user and user != "root" and miner.web:
                        miner.web.username = user
                        
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
            # First attempt with all requested options
            try:
                miner_data = await asyncio.wait_for(miner.get_data(include=data_options), timeout=25)
            except Exception as e:
                _LOGGER.debug(f"[{self.miner_ip}] Full data fetch failed: {e}. Trying minimal summary-only fetch...")
                minimal_options = [
                    pyasic.DataOptions.IS_MINING,
                    pyasic.DataOptions.HASHRATE,
                    pyasic.DataOptions.WATTAGE,
                    pyasic.DataOptions.FANS,
                ]
                try:
                    miner_data = await asyncio.wait_for(miner.get_data(include=minimal_options), timeout=20)
                except Exception as e2:
                    _LOGGER.warning(f"[{self.miner_ip}] Resilient update failed: {e2}. Trying RAW Ultra-Fallback...")
                    try:
                        # 3. Ultra-Fallback: Raw API (Bypass Pyasic Parsing)
                        from types import SimpleNamespace
                        raw_summary = await asyncio.wait_for(miner.api.summary(), timeout=10)
                        raw_stats = await asyncio.wait_for(miner.api.stats(), timeout=10)
                        
                        hr = 0
                        is_mining = False
                        if raw_summary and "SUMMARY" in raw_summary and len(raw_summary["SUMMARY"]) > 0:
                            s_obj = raw_summary["SUMMARY"][0]
                            hr = float(s_obj.get("GHS 5s", 0) or s_obj.get("GHS av", 0))
                            is_mining = hr > 0
                        
                        wattage = 0
                        temperature = 0
                        if raw_stats and "STATS" in raw_stats and len(raw_stats["STATS"]) > 1:
                            st_obj = raw_stats["STATS"][1]
                            wattage = float(st_obj.get("power", 0) or st_obj.get("Power", 0))
                            temperature = float(st_obj.get("temp1", 0) or st_obj.get("Temp", 0))
                            
                        # Package for the loop
                        miner_data = SimpleNamespace(
                            hashrate=hr,
                            wattage=wattage,
                            temperature_avg=temperature,
                            is_mining=is_mining,
                            expected_hashrate=0,
                            fans=[],
                            hashboards=[]
                        )
                        _LOGGER.info(f"[{self.miner_ip}] Ultra-Fallback successful! HR: {hr}, W: {wattage}")
                    except Exception as e3:
                        _LOGGER.error(f"[{self.miner_ip}] Ultra-Fallback also failed: {e3}")
                        raise
                
            self._failure_count = 0

            # [FIX] Enhanced Hashrate Scaling (BOS+, VNish, Stock)
            # 1. H/s (e.g. 200,000,000,000,000) -> Divide by 1e12
            # 2. GH/s (e.g. 200,000) -> Divide by 1000
            # 3. TH/s (e.g. 200) -> Keep as is
            raw_hr = float(getattr(miner_data, "hashrate", 0) or 0)
            if raw_hr > 1000000000: # > 1 GH/s in H/s
                 hr = round(raw_hr / 1e12, 2)
            elif raw_hr > 5000:    # > 5 TH/s in GH/s
                 hr = round(raw_hr / 1000, 2)
            else:
                 hr = round(raw_hr, 2)

            raw_exp = float(getattr(miner_data, "expected_hashrate", 0) or 0)
            if raw_exp > 1000000000: exp_hr = round(raw_exp / 1e12, 2)
            elif raw_exp > 5000: exp_hr = round(raw_exp / 1000, 2)
            else: exp_hr = round(raw_exp, 2)
            
            # [FIX] Efficiency Fallback
            wattage = float(getattr(miner_data, "wattage", 0) or 0)
            efficiency = getattr(miner_data, "efficiency", 0) or getattr(miner_data, "efficiency_fract", 0)
            if (not efficiency or efficiency == 0) and hr > 0:
                 efficiency = round(wattage / hr, 1)

            # [FIX] Avalon & VNish Standby/Power Detection
            is_mining = getattr(miner_data, "is_mining", False)
            miner_fw = str(getattr(miner, "firmware", "")).lower()
            
            if "Avalon" in self.miner_make:
                # Fallback for missing/zero wattage on some Avalon models
                if wattage == 0:
                    try:
                         raw_summary = await miner.api.send_command("summary")
                         # Avalon summary is often comma-separated string like '...,Cur Load=816,...'
                         if raw_summary and isinstance(raw_summary, str):
                              import re
                              match = re.search(r"Cur Load=(\d+)", raw_summary)
                              if not match: match = re.search(r"Power=(\d+)", raw_summary)
                              if match:
                                   wattage = float(match.group(1))
                                   _LOGGER.debug(f"[{self.miner_ip}] Extracted raw wattage: {wattage}W")
                    except Exception as e:
                         _LOGGER.debug(f"[{self.miner_ip}] Avalon raw summary extraction failed: {e}")

                if hr == 0 and wattage < 150:
                    is_mining = False
                elif hr > 0:
                    is_mining = True
            
            elif "vnish" in miner_fw:
                # VNish specific: hashrate might be 0 while starting
                if hr > 0: is_mining = True
                if wattage < 100 and hr == 0: is_mining = False

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

            # Improved firmware version display
            fw_ver = getattr(miner_data, "fw_ver", None)
            if not fw_ver and "vnish" in miner_fw:
                fw_ver = f"VNish {getattr(miner, 'version', '')}"

            # [NEW] Extract raw generic properties for dynamic hass-miner style entities
            import dataclasses
            raw_data = {}
            if dataclasses.is_dataclass(miner_data):
                for k, v in dataclasses.asdict(miner_data).items():
                    if not isinstance(v, (list, dict)):
                        raw_data[k] = v
            else:
                raw_data = vars(miner_data)

            return {
                "hostname": getattr(miner_data, "hostname", self.miner_name),
                "mac": getattr(miner_data, "mac", None),
                "make": getattr(miner_data, "make", self.miner_make),
                "model": getattr(miner_data, "model", self.miner_model),
                "ip": self.miner_ip,
                "is_mining": is_mining,
                "fw_ver": fw_ver,
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
                "raw_data": raw_data,
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
