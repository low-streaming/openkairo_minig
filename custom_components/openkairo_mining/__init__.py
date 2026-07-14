import logging
import json
import os
import time
import tempfile
from .engine import MiningEngine

DOMAIN = "openkairo_mining"
_LOGGER = logging.getLogger(__name__)

CONFIG_FILE = "openkairo_mining_config.json"

PLATFORMS = [
    "sensor",
    "switch",
    "binary_sensor",
    "number",
    "select",
]

from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components.http import HomeAssistantView
from homeassistant.const import EVENT_HOMEASSISTANT_START
from homeassistant.components.frontend import async_register_built_in_panel, async_remove_panel

async def async_setup(hass: HomeAssistant, config: dict):
    from .patch import ensure_pyasic
    await hass.async_add_executor_job(ensure_pyasic)
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    _LOGGER.info(f"Setting up OpenKairo Mining Integration: {entry.title}")
    
    from .patch import ensure_pyasic
    await hass.async_add_executor_job(ensure_pyasic)
    
    hass.data.setdefault(DOMAIN, {})
    
    if "ip_address" in entry.data:
        hass.data[DOMAIN].setdefault("miners", {})
        hass.data[DOMAIN]["miners"][entry.entry_id] = entry.data
        hass.data[DOMAIN].setdefault("coordinators", {})
        
        async def sync_with_config():
            import asyncio as _asyncio
            from homeassistant.helpers import entity_registry as er
            # Wait for platform setup to complete so entities are in the registry.
            await _asyncio.sleep(5)
            try:
                lock = hass.data[DOMAIN].setdefault("_config_lock", _asyncio.Lock())
                async with lock:
                    config = await hass.async_add_executor_job(_load_config, hass)
                    ip = entry.data["ip_address"]
                    safe_ip = ip.replace('.', '_')

                    ent_reg = er.async_get(hass)

                    def _lookup(platform, uid_suffix):
                        uid = f"{DOMAIN}_{safe_ip}_{uid_suffix}"
                        return ent_reg.async_get_entity_id(platform, DOMAIN, uid)

                    auto_entities = {}
                    for platform, uid_suffix, cfg_key in [
                        ("switch", "mining_aktiv", "switch"),
                        ("number", "power_limit", "power_entity"),
                        ("sensor", "hashrate", "hashrate_sensor"),
                        ("sensor", "temperature", "temp_sensor"),
                        ("sensor", "power", "power_consumption_sensor"),
                    ]:
                        eid = _lookup(platform, uid_suffix)
                        if eid:
                            auto_entities[cfg_key] = eid

                    existing_idx = next((i for i, m in enumerate(config.get("miners", [])) if m.get("miner_ip") == ip), None)
                    if existing_idx is None:
                        import uuid
                        new_miner = {
                            "id": str(uuid.uuid4()),
                            "name": entry.title,
                            "miner_ip": ip,
                            "miner_user": entry.data.get("username", "root"),
                            "miner_password": entry.data.get("password", ""),
                            "priority": "10",
                            "mode": "manual",
                            "min_power": entry.data.get("min_power", 400),
                            "max_power": entry.data.get("max_power", 1400),
                            **auto_entities,
                        }
                        config["miners"].append(new_miner)
                        await hass.async_add_executor_job(_save_config, hass, config)
                    else:
                        miner = config["miners"][existing_idx]
                        changed = False
                        for key, val in auto_entities.items():
                            if key not in miner or not miner.get(key):
                                miner[key] = val
                                changed = True
                        if changed:
                            await hass.async_add_executor_job(_save_config, hass, config)
            except Exception as e:
                _LOGGER.error(f"sync_with_config failed for {entry.data.get('ip_address')}: {e}")

        hass.async_create_task(sync_with_config())
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
        return True
    
    hass.data[DOMAIN]["config"] = await hass.async_add_executor_job(_load_config, hass)
    hass.data[DOMAIN]["entry_id"] = entry.entry_id
    
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="OpenKairo Mining",
        sidebar_icon="mdi:lightning-bolt",
        frontend_url_path="openkairo_mining",
        config={
            "_panel_custom": {
                "name": "openkairo-mining-panel",
                "module_url": f"/api/{DOMAIN}/frontend/openkairo-mining-panel.js?v=1.4.15"
            }
        },
        require_admin=True
    )

    hass.http.register_view(OpenKairoMiningFrontendView())
    hass.http.register_view(OpenKairoMiningApiView())
    
    from .services import async_setup_services
    await async_setup_services(hass)

    if not hass.data[DOMAIN].get("engine"):
        engine = MiningEngine(hass)
        hass.data[DOMAIN]["engine"] = engine
        if hass.is_running:
            task = hass.loop.create_task(engine.async_run())
            hass.data[DOMAIN]["engine_task"] = task
        else:
            def _start_engine(event):
                task = hass.loop.create_task(engine.async_run())
                hass.data[DOMAIN]["engine_task"] = task
            hass.bus.async_listen_once(EVENT_HOMEASSISTANT_START, _start_engine)

    await hass.config_entries.async_forward_entry_setups(entry, ["sensor"])

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    if "ip_address" in entry.data:
        unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
        if unload_ok and entry.entry_id in hass.data[DOMAIN].get("miners", {}):
            hass.data[DOMAIN]["miners"].pop(entry.entry_id)
        return unload_ok
    engine_task = hass.data[DOMAIN].get("engine_task")
    if engine_task and not engine_task.done():
        engine_task.cancel()
    async_remove_panel(hass, "openkairo_mining")
    await hass.config_entries.async_unload_platforms(entry, ["sensor"])
    return True

def _get_config_path(hass):
    return hass.config.path(CONFIG_FILE)

def _load_config(hass):
    path = _get_config_path(hass)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                return data if "miners" in data else {"miners": []}
            except json.JSONDecodeError as e:
                _LOGGER.error(f"Config file corrupt, using empty config: {e}")
    return {"miners": []}

def _save_config(hass, data):
    path = _get_config_path(hass)
    try:
        tmp_fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        os.replace(tmp_path, path)
    except Exception as e:
        _LOGGER.error(f"Failed to save config: {e}")
        return
    if DOMAIN in hass.data:
        hass.data[DOMAIN]["config"] = data


def _add_log_entry(hass, message):
    """Proxy to the engine log — used by entities that change config via HA UI."""
    engine = hass.data.get(DOMAIN, {}).get("engine")
    if engine:
        engine.add_log_entry(message)
    else:
        _LOGGER.info(f"[OpenKairo Log] {message}")

class OpenKairoMiningFrontendView(HomeAssistantView):
    url = f"/api/{DOMAIN}/frontend/openkairo-mining-panel.js"
    name = f"api:{DOMAIN}:frontend"
    requires_auth = False

    async def get(self, request):
        path = os.path.join(os.path.dirname(__file__), "openkairo-mining-panel.js")
        hass = request.app["hass"]
        try:
            def _read_js():
                with open(path, "r", encoding="utf-8") as f:
                    return f.read()
            content = await hass.async_add_executor_job(_read_js)
            from aiohttp import web
            return web.Response(body=content, content_type="application/javascript")
        except OSError as e:
            _LOGGER.error(f"Frontend JS not found at {path}: {e}")
            from aiohttp import web
            return web.Response(status=404)

class OpenKairoMiningApiView(HomeAssistantView):
    url = f"/api/{DOMAIN}/data"
    name = f"api:{DOMAIN}:data"
    requires_auth = False

    async def get(self, request):
        hass = request.app["hass"]
        engine = hass.data.get(DOMAIN, {}).get("engine")
        config = hass.data.get(DOMAIN, {}).get("config", {"miners": []})
        states = engine.miner_states if engine else {}
        is_short = request.query.get("short") == "1" or request.query.get("display") == "1"
        if is_short:
            config = {"miners": [{k: v for k, v in m.items() if k != "image"} for m in config.get("miners", [])]}
        clean_states = {}
        for mid, s in states.items():
            clean_s = {k: v for k, v in s.items() if k != "active_ramping_task"}
            wd_start = s.get("standby_since")
            clean_s["watchdog_remaining"] = 0
            clean_s["watchdog_cooldown_remaining"] = 0
            try:
                m_cfg = next((m for m in config.get("miners", []) if m.get("id") == mid or m.get("miner_ip") == mid), {})
                if m_cfg.get("standby_watchdog_enabled"):
                    delay = float(m_cfg.get("standby_delay", 10)) * 60
                    if wd_start:
                        clean_s["watchdog_remaining"] = int(max(0, delay - (time.time() - wd_start)))
                    wd_last = s.get("watchdog_last_action", 0)
                    if wd_last:
                        cooldown = max(delay, 300)
                        clean_s["watchdog_cooldown_remaining"] = int(max(0, cooldown - (time.time() - wd_last)))
            except Exception:
                pass
            sw_on, is_mining, ramping = s.get("is_on", False), s.get("is_mining", False), s.get("ramping")
            if not sw_on: clean_s["status_msg"] = "AUS"
            elif ramping == "up": clean_s["status_msg"] = "SOFT-UP"
            elif ramping == "down": clean_s["status_msg"] = "SOFT-DN"
            elif sw_on and not is_mining: clean_s["status_msg"] = "STANDBY"
            elif is_mining: clean_s["status_msg"] = "MINING"
            else: clean_s["status_msg"] = "AUS"
            # Temp alarm indicator
            if s.get("temp_alarm"):
                clean_s["status_msg"] = "TEMP-ALARM"
            # Computed stat fields (formatted for display)
            clean_s["session_runtime_h"] = round(s.get("session_runtime_s", 0) / 3600, 2)
            clean_s["today_runtime_h"] = round(s.get("today_runtime_s", 0) / 3600, 2)
            clean_s["session_energy_wh"] = round(s.get("session_energy_wh", 0.0), 1)
            clean_s["today_energy_wh"] = round(s.get("today_energy_wh", 0.0), 1)
            clean_s["total_starts"] = s.get("total_starts", 0)
            # Decision reasons — shown in miner card as "Letzte Entscheidung"
            clean_s["log_reason_on"] = s.get("log_reason_on", "")
            clean_s["log_reason_off"] = s.get("log_reason_off", "")
            clean_states[mid] = clean_s
        mempool = engine.mempool_data if engine else {}
        btc_price = engine.btc_price if engine else 0
        global_soc = 0
        for m in config.get("miners", []):
            bat_sensor = m.get("battery_sensor")
            if bat_sensor:
                s = hass.states.get(bat_sensor)
                if s and s.state not in ["unknown", "unavailable"]:
                    try:
                        global_soc = float(s.state)
                        break
                    except (ValueError, TypeError):
                        pass
        logs = [] if is_short else (engine.logs if engine else [])
        fleet_power = sum(float(s.get("power", 0)) for s in clean_states.values() if s.get("is_on"))
        fleet_budget = config.get("fleet_max_power")
        from aiohttp import web
        return web.json_response({
            "status": "ok",
            "config": config,
            "states": clean_states,
            "mempool": mempool,
            "btc_price": btc_price,
            "soc": global_soc,
            "logs": logs,
            "fleet": {
                "total_power_w": round(fleet_power, 1),
                "budget_w": fleet_budget,
                "miners_on": sum(1 for s in clean_states.values() if s.get("is_on")),
                "miners_mining": sum(1 for s in clean_states.values() if s.get("is_mining")),
            }
        })

    async def post(self, request):
        hass = request.app["hass"]
        try:
            data = await request.json()
            if "action" in data:
                action = data["action"]
                config = hass.data.get(DOMAIN, {}).get("config", {"miners": []})
                for m in config.get("miners", []):
                    ip = m.get("miner_ip")
                    if ip:
                        if action == "restart": await hass.services.async_call(DOMAIN, "restart_backend", {"ip_address": ip})
                        elif action == "reboot": await hass.services.async_call(DOMAIN, "reboot", {"ip_address": ip})
                from aiohttp import web
                return web.json_response({"status": "success", "action": action})
            if "update_miner_config" in data:
                mid, params = data["update_miner_config"], data.get("params", {})
                config = hass.data.get(DOMAIN, {}).get("config", {"miners": []})
                for m in config.get("miners", []):
                    if m.get("id") == mid or m.get("miner_ip") == mid:
                        for k, v in params.items(): m[k] = v
                        break
                await hass.async_add_executor_job(_save_config, hass, config)
                from aiohttp import web
                return web.json_response({"status": "success", "updated": mid})
            if "update_global_config" in data:
                params = data.get("params", {})
                config = hass.data.get(DOMAIN, {}).get("config", {"miners": []})
                for k, v in params.items():
                    config[k] = v
                await hass.async_add_executor_job(_save_config, hass, config)
                from aiohttp import web
                return web.json_response({"status": "success", "updated": "all"})
            await hass.async_add_executor_job(_save_config, hass, data)
            hass.data[DOMAIN]["config"] = await hass.async_add_executor_job(_load_config, hass)
            from aiohttp import web
            return web.json_response({"status": "ok", "message": "Konfiguration gespeichert"})
        except Exception as e:
            _LOGGER.error(f"Error in API POST: {e}")
            from aiohttp import web
            return web.json_response({"status": "error", "message": str(e)}, status=500)
