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
    _last_discovery_fail: float = 0
    DISCOVERY_COOLDOWN: int = 300 # 5 Minutes

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
        """Get or refresh the miner object with parallel discovery."""
        import pyasic
        import asyncio
        import aiohttp

        if self.miner_obj is not None:
            return self.miner_obj

        # Check cooldown
        import time
        now = time.time()
        if now - self._last_discovery_fail < self.DISCOVERY_COOLDOWN:
            _LOGGER.debug(f"[{self.miner_ip}] Discovery im Cooldown (Miner offline?). Nächster Versuch in {int(self.DISCOVERY_COOLDOWN - (now - self._last_discovery_fail))}s")
            return None

        _LOGGER.debug(f"[{self.miner_ip}] Coordinator startet prioritierte Miner-Suche...")
        
        # [FIX] Force Stock if user named it so
        force_stock = "(Stock)" in str(self.config_entry.title)
        
        async def check_pbfarmer():
            if force_stock:
                _LOGGER.debug(f"[{self.miner_ip}] '(Stock)' im Titel erkannt. Überspringe PBfarmer-Check.")
                return None
            
            # Stricter check for PBfarmer
            endpoints = [
                f"http://{self.miner_ip}/api/overview",
                f"https://{self.miner_ip}/api/overview",
                f"http://{self.miner_ip}:4111/api/overview"
            ]
            token = self.config_entry.data.get("api_token")
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=12)) as session:
                for url in endpoints:
                    try:
                        headers = {"Authorization": f"Bearer {token}"} if token else {}
                        async with session.get(url, ssl=False, headers=headers) as resp:
                            if resp.status == 200:
                                try:
                                    json_data = await resp.json()
                                    # ONLY match if it's really PBfarmer
                                    if "PBfarmer" in str(json_data) or "softver" in str(json_data):
                                        _LOGGER.info(f"[{self.miner_ip}] PBfarmer verifiziert via {url}")
                                        class MinerStub:
                                            def __init__(self, ip):
                                                self.ip = ip
                                                self._is_stub = True
                                                self.make = "IceRiver"
                                                self.model = "KS0 (PBfarmer)"
                                        return {"title": "KS0 (PBfarmer)", "miner": MinerStub(self.miner_ip)}
                                except Exception: pass
                            elif resp.status in [401, 403]:
                                # If auth is required on this specific path, it's likely PBfarmer
                                _LOGGER.info(f"[{self.miner_ip}] PBfarmer vermutet (Auth Req) via {url}")
                                class MinerStub:
                                    def __init__(self, ip):
                                        self.ip = ip
                                        self._is_stub = True
                                        self.make = "IceRiver"
                                        self.model = "KS0 (PBfarmer)"
                                return {"title": "KS0 (PBfarmer)", "miner": MinerStub(self.miner_ip)}
                    except Exception: continue
            return None

        async def check_generic_http_api():
            # Check for Bitaxe / NerdMiner / ESP32 Generic API
            endpoints = [
                f"http://{self.miner_ip}/api",
                f"http://{self.miner_ip}/stats",
            ]
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                for url in endpoints:
                    try:
                        async with session.get(url, ssl=False) as resp:
                            if resp.status == 200:
                                try:
                                    json_data = await resp.json()
                                    # Heuristic: If it has hashrate or shares, it's likely a miner
                                    if "hashrate" in json_data or "shares" in json_data or "freq" in json_data:
                                        model = json_data.get("model", "NerdMiner/Bitaxe")
                                        _LOGGER.info(f"[{self.miner_ip}] Generic HTTP Miner ({model}) found via {url}")
                                        class MinerStub:
                                            def __init__(self, ip, model):
                                                self.ip = ip
                                                self._is_stub = True
                                                self._stub_type = "generic_http"
                                                self.make = "ESP32"
                                                self.model = model
                                        return {"title": model, "miner": MinerStub(self.miner_ip, model)}
                                except Exception: pass
                    except Exception: continue
            return None

        async def check_pyasic_standard():
            # Standard pyasic probe
            try:
                miner = await asyncio.wait_for(pyasic.get_miner(self.miner_ip), timeout=10)
                if miner: return {"title": getattr(miner, "model", "ASIC"), "miner": miner}
            except Exception: pass
            return None

        async def check_pyasic_port_4028():
            try:
                reader, writer = await asyncio.wait_for(asyncio.open_connection(self.miner_ip, 4028), timeout=5)
                writer.write(b'{"command":"summary"}')
                await writer.drain()
                resp = await reader.read(4096)
                writer.close()
                await writer.wait_closed()
                if resp:
                    from pyasic.miners.antminer.bm_miner.S19 import AntminerS19
                    miner = AntminerS19(self.miner_ip)
                    return {"title": "Antminer/VNish (4028)", "miner": miner}
            except Exception: pass
            return None

        # Run in parallel
        tasks = [
            asyncio.create_task(check_pbfarmer()), 
            asyncio.create_task(check_generic_http_api()),
            asyncio.create_task(check_pyasic_standard()),
            asyncio.create_task(check_pyasic_port_4028())
        ]
        done, pending = await asyncio.wait(tasks, timeout=12, return_when=asyncio.FIRST_COMPLETED)
        
        result = None
        for t in done:
            result = t.result()
            if result: break
        
        if not result:
            for t in asyncio.as_completed(pending):
                result = await t
                if result: break
        
        for t in pending: t.cancel()

        if result:
            miner = result["miner"]
            self.miner_obj = miner
            self.miner_model = result["title"]
            self.miner_make = getattr(miner, "make", "IceRiver" if "PBfarmer" in result["title"] else "ESP32" if hasattr(miner, "_stub_type") else "OpenKairo")
            
            # Application of credentials
            if "PBfarmer" not in str(result["title"]):
                pwd = self.config_entry.data.get("password")
                user = self.config_entry.data.get("username", "root")
                if pwd:
                    if hasattr(miner, "api") and miner.api: miner.api.pwd = pwd
                    if hasattr(miner, "web") and miner.web: miner.web.pwd = pwd
                if user and user != "root" and hasattr(miner, "web") and miner.web:
                    miner.web.username = user
                if hasattr(miner, "ssh") and miner.ssh:
                    miner.ssh.username = self.config_entry.data.get("ssh_username", "root")
                    miner.ssh.pwd = self.config_entry.data.get("ssh_password") or ""
            
            return self.miner_obj

        _LOGGER.debug(f"[{self.miner_ip}] Coordinator konnte keine Verbindung zum Miner herstellen. Starte Cooldown.")
        self._last_discovery_fail = time.time()
        return None

    async def _async_update_data(self):
        """Fetch data from the ASIC."""
        import pyasic
        import asyncio
        
        miner = await self._get_miner()

        if miner is None:
            self._failure_count += 1
            if self._failure_count <= 2:
                return {**DEFAULT_DATA, "ip": self.miner_ip, "model": self.miner_model or "ASIC", "make": self.miner_make or "OpenKairo"}
            raise UpdateFailed(f"Miner at {self.miner_ip} unreachable.")

        try:
            # [NEW] Skip pyasic probing for PBfarmer (MinerStub)
            # [NEW] Skip pyasic probing for Stubs (PBfarmer or Generic HTTP)
            if hasattr(miner, "_is_stub"):
                if getattr(miner, "_stub_type", None) == "generic_http":
                    miner_data = await self._fetch_generic_http_data()
                else:
                    api_token = self.config_entry.data.get("api_token")
                    miner_data = await self._fetch_pbfarmer_data(api_token)
                
                if not miner_data:
                    self._failure_count += 1
                    raise UpdateFailed("Miner API returned no data (Offline or API changed)")
                _LOGGER.debug(f"[{self.miner_ip}] Stub data collection successful!")
            else:
                # Standard PyAsic Flow
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

                # Attempt with all requested options, with multi-stage fallbacks
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
                        # 3. Ultra-Fallback: Raw API (Bypass Pyasic Parsing)
                        from types import SimpleNamespace
                        raw_summary = await asyncio.wait_for(miner.api.summary(), timeout=10)
                        raw_stats = await asyncio.wait_for(miner.api.stats(), timeout=10)
                        
                        hr_val = 0
                        is_mining_val = False
                        if raw_summary and "SUMMARY" in raw_summary and len(raw_summary["SUMMARY"]) > 0:
                            s_obj = raw_summary["SUMMARY"][0]
                            hr_val = float(s_obj.get("GHS 5s", 0) or s_obj.get("GHS av", 0))
                            is_mining_val = hr_val > 0
                        
                        wattage_val = 0
                        temperature_val = 0
                        if raw_stats and "STATS" in raw_stats and len(raw_stats["STATS"]) > 1:
                            st_obj = raw_stats["STATS"][1]
                            wattage_val = float(st_obj.get("power", 0) or st_obj.get("Power", 0))
                            temperature_val = float(st_obj.get("temp1", 0) or st_obj.get("Temp", 0))
                            
                        miner_data = SimpleNamespace(
                            hashrate=hr_val,
                            wattage=wattage_val,
                            temperature_avg=temperature_val,
                            is_mining=is_mining_val,
                            expected_hashrate=0,
                            fans=[],
                            hashboards=[]
                        )
                        _LOGGER.info(f"[{self.miner_ip}] Ultra-Fallback successful! HR: {hr_val}, W: {wattage_val}")

            self._failure_count = 0

            # [FIX] Enhanced Hashrate Scaling (BOS+, VNish, Stock, Bitaxe)
            raw_hr = float(getattr(miner_data, "hashrate", 0) or 0)
            # Scaling rules:
            # - If > 1e12: it's likely H/s (Antminer Stock) -> convert to TH/s
            # - If > 1e9: it's likely GH/s (Bitaxe/NerdMiner) -> convert to TH/s (or keep GH/s?) 
            #   The dashboard expects TH/s for large miners and GH/s for small ones.
            #   Let's keep GH/s if it's < 1000 GH/s, otherwise TH/s.
            
            if raw_hr > 1e11: # > 100 GH/s in H/s
                 hr = round(raw_hr / 1e12, 2)
            elif raw_hr > 5000: # > 5 TH/s in GH/s (some APIs)
                 hr = round(raw_hr / 1000, 2)
            else:
                 hr = round(raw_hr, 2)

            raw_exp = float(getattr(miner_data, "expected_hashrate", 0) or 0)
            if raw_exp > 1e11: exp_hr = round(raw_exp / 1e12, 2)
            elif raw_exp > 5000: exp_hr = round(raw_exp / 1000, 2)
            else: exp_hr = round(raw_exp, 2)
            
            # [FIX] Efficiency Fallback
            wattage = float(getattr(miner_data, "wattage", 0) or 0)
            
            if wattage == 0:
                raw_s = getattr(miner_data, "raw_data", {})
                wattage = float(raw_s.get("Power", raw_s.get("power", 0)))

            efficiency = getattr(miner_data, "efficiency", 0) or getattr(miner_data, "efficiency_fract", 0)
            if (not efficiency or efficiency == 0) and hr > 0:
                 efficiency = round(wattage / hr, 1)

            # [FIX] Avalon & VNish Standby/Power Detection
            is_mining = getattr(miner_data, "is_mining", False)
            miner_fw = str(getattr(miner, "firmware", "") or "").lower()
            m_make = str(self.miner_make or "").lower()
            
            if "avalon" in m_make:
                if wattage == 0:
                    try:
                         raw_summary = await miner.api.send_command("summary")
                         if raw_summary and isinstance(raw_summary, str):
                              import re
                              match = re.search(r"Cur Load=(\d+)", raw_summary)
                              if not match: match = re.search(r"Power=(\d+)", raw_summary)
                              if match:
                                   wattage = float(match.group(1))
                    except Exception: pass

                if hr == 0 and wattage < 150:
                    is_mining = False
                elif hr > 0:
                    is_mining = True
            
            elif "vnish" in miner_fw:
                if hr > 0: is_mining = True
                if wattage < 100 and hr == 0: is_mining = False
            
            elif "bitaxe" in str(getattr(miner_data, "model", "")).lower():
                # Bitaxe power is often very low in standby
                if hr > 0: is_mining = True
                if wattage < 5 and hr == 0: is_mining = False

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
                raw_data = getattr(miner_data, "__dict__", {})
                if not raw_data and hasattr(miner_data, "__slots__"):
                    raw_data = {s: getattr(miner_data, s) for s in miner_data.__slots__ if hasattr(miner_data, s)}

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

    async def _fetch_pbfarmer_data(self, token: str):
        """Fetch data from the PBfarmer API (HTTP/HTTPS)."""
        import aiohttp
        from types import SimpleNamespace
        
        endpoints = [
            f"http://{self.miner_ip}/api/overview",
            f"https://{self.miner_ip}/api/overview",
            f"http://{self.miner_ip}:4111/api/overview"
        ]
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            for url in endpoints:
                try:
                    _LOGGER.debug(f"[{self.miner_ip}] Versuche PBfarmer Datenabruf: {url}")
                    async with session.get(url, ssl=False, headers=headers) as resp:
                        if resp.status == 401:
                            _LOGGER.error(f"[{self.miner_ip}] PBfarmer: Authentifizierung fehlt/falsch.")
                            return None
                        if resp.status != 200: continue
                        
                        res = await resp.json()
                        if res.get("error", 0) != 0:
                            _LOGGER.debug(f"[{self.miner_ip}] PBfarmer API Fehler: {res.get('message')}")
                            continue

                        d = res.get("data", {})
                        
                        # Mapping
                        def parse_hr(val):
                            if not val or not isinstance(val, str): return 0
                            v = val.replace(",", ".")
                            if v.endswith("G"): return float(v[:-1])
                            if v.endswith("T"): return float(v[:-1]) * 1000
                            try: return float(v)
                            except: return 0

                        # Fans & Boards
                        fans = [SimpleNamespace(speed=s) for s in d.get("fans", [])]
                        boards = []
                        for b in d.get("boards", []):
                            boards.append(SimpleNamespace(
                                slot=int(b.get("no", 0)),
                                temp=b.get("outtmp", 0),
                                chip_temp=b.get("chiptmp", 0),
                                hashrate=parse_hr(b.get("rtpow", "0")),
                                chips=b.get("chipsuc", 0),
                                expected_chips=b.get("chipnum", 0)
                            ))

                        return SimpleNamespace(
                            hashrate=parse_hr(d.get("rtpow", "0")),
                            expected_hashrate=parse_hr(d.get("idealpow", "0")),
                            wattage=float(d.get("wattage", 0)),
                            temperature_avg=d.get("tempstate", 0),
                            is_mining=d.get("netstate", False),
                            fw_ver=f"PBfarmer {d.get('softver1', '')}",
                            hostname=d.get("host"),
                            mac=d.get("mac"),
                            model=f"{d.get('model', 'ASIC')} (PBfarmer)",
                            make="IceRiver",
                            uptime=d.get("runtime"),
                            wattage_limit=0,
                            fans=fans,
                            hashboards=boards,
                            raw_data=d
                        )
                except Exception as e:
                    _LOGGER.debug(f"[{self.miner_ip}] PBfarmer Abruf {url} fehlgeschlagen: {e}")
                    continue
        return None

    async def _fetch_generic_http_data(self):
        """Fetch data from ESP32 miners (Bitaxe/NerdMiner) via /api or /stats."""
        import aiohttp
        from types import SimpleNamespace
        
        endpoints = [
            f"http://{self.miner_ip}/api",
            f"http://{self.miner_ip}/stats"
        ]
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as session:
            for url in endpoints:
                try:
                    async with session.get(url, ssl=False) as resp:
                        if resp.status != 200: continue
                        
                        d = await resp.json()
                        
                        # Mapping logic for Bitaxe and variants (Source: Bitaxe/ESP-Miner API)
                        # We try both small and camelCase keys
                        raw_hr = d.get("hashrate", d.get("hashRate", 0))
                        # Bitaxe often reports GH/s, PBfarmer/ASICs often report TH/s or H/s
                        # If raw_hr is < 5000, we assume it's GH/s (Bitaxe range)
                        # We convert it to TH/s for internal consistency in the sensor loop
                        hr_th = float(raw_hr) / 1000 if float(raw_hr) > 10 else float(raw_hr)

                        # Power handling (Bitaxe pow is in Watts, NerdMiner often missing)
                        pow_w = float(d.get("pow", d.get("power", 0)))
                        
                        # Voltage (mV to V)
                        volt_v = float(d.get("volt", d.get("voltage", 0)))
                        if volt_v > 100: volt_v = volt_v / 1000

                        return SimpleNamespace(
                            hashrate=hr_th,
                            expected_hashrate=float(d.get("expectedHashrate", 0)) / 1000,
                            wattage=pow_w,
                            temperature_avg=d.get("temp", d.get("temperature", d.get("chipTemp", 0))),
                            is_mining=d.get("mining", True),
                            fw_ver=d.get("version", d.get("fwVersion", "ESP-Miner")),
                            hostname=d.get("hostname", d.get("name", self.miner_name)),
                            mac=d.get("mac"),
                            model=d.get("model", "Bitaxe/NerdMiner"),
                            make="ESP32",
                            uptime=d.get("uptime", 0),
                            wattage_limit=0,
                            fans=[SimpleNamespace(speed=d.get("fanRPM", d.get("fan", 0)))],
                            hashboards=[],
                            raw_data=d
                        )
                except Exception as e:
                    _LOGGER.debug(f"[{self.miner_ip}] Generic HTTP Abruf {url} fehlgeschlagen: {e}")
                    continue
        return None


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
