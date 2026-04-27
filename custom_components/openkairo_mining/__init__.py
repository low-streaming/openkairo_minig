import logging
import json
import os
import time
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
            config = await hass.async_add_executor_job(_load_config, hass)
            ip = entry.data["ip_address"]
            safe_ip = ip.replace('.', '_')
            auto_entities = {
                "switch": f"switch.{DOMAIN}_{safe_ip}_mining_aktiv",
                "power_entity": f"number.{DOMAIN}_{safe_ip}_power_limit",
                "hashrate_sensor": f"sensor.{DOMAIN}_{safe_ip}_hashrate",
                "temp_sensor": f"sensor.{DOMAIN}_{safe_ip}_temperature",
                "power_consumption_sensor": f"sensor.{DOMAIN}_{safe_ip}_power",
            }
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
                "module_url": f"/api/{DOMAIN}/frontend/openkairo-mining-panel.js?v=1.3.21"
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
            hass.loop.create_task(engine.async_run())
        else:
            hass.bus.async_listen_once(EVENT_HOMEASSISTANT_START, lambda event: hass.loop.create_task(engine.async_run()))
    
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    if "ip_address" in entry.data:
        unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
        if unload_ok and entry.entry_id in hass.data[DOMAIN].get("miners", {}):
            hass.data[DOMAIN]["miners"].pop(entry.entry_id)
        return unload_ok
    async_remove_panel(hass, "openkairo_mining")
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
            except: pass
    return {"miners": []}

def _save_config(hass, data):
    path = _get_config_path(hass)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)
    if DOMAIN in hass.data:
        hass.data[DOMAIN]["config"] = data

class OpenKairoMiningFrontendView(HomeAssistantView):
    url = f"/api/{DOMAIN}/frontend/openkairo-mining-panel.js"
    name = f"api:{DOMAIN}:frontend"
    requires_auth = False

    async def get(self, request):
        path = os.path.join(os.path.dirname(__file__), "openkairo-mining-panel.js")
        hass = request.app["hass"]
        try:
            content = await hass.async_add_executor_job(lambda: open(path, "r", encoding="utf-8").read())
            from aiohttp import web
            return web.Response(body=content, content_type="application/javascript")
        except:
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
            if wd_start:
                try:
                    m_cfg = next((m for m in config.get("miners", []) if m.get("id") == mid or m.get("miner_ip") == mid), {})
                    if m_cfg.get("standby_watchdog_enabled"):
                        delay = float(m_cfg.get("standby_delay", 10)) * 60
                        clean_s["watchdog_remaining"] = int(max(0, delay - (time.time() - wd_start)))
                except: pass
            sw_on, is_mining, ramping = s.get("is_on", False), s.get("is_mining", False), s.get("ramping")
            if not sw_on: clean_s["status_msg"] = "AUS"
            elif ramping == "up": clean_s["status_msg"] = "SOFT-UP"
            elif ramping == "down": clean_s["status_msg"] = "SOFT-DN"
            elif sw_on and not is_mining: clean_s["status_msg"] = "STANDBY"
            elif is_mining: clean_s["status_msg"] = "MINING"
            clean_states[mid] = clean_s
        mempool = engine.mempool_data if engine else {}
        btc_price = engine.btc_price if engine else 0
        global_soc = 0
        for m in config.get("miners", []):
            bat_sensor = m.get("battery_sensor")
            if bat_sensor:
                s = hass.states.get(bat_sensor)
                if s and s.state not in ["unknown", "unavailable"]:
                    try: global_soc = float(s.state); break
                    except: pass
        logs = [] if is_short else (engine.logs if engine else [])
        from aiohttp import web
        return web.json_response({"status": "ok", "config": config, "states": clean_states, "mempool": mempool, "btc_price": btc_price, "soc": global_soc, "logs": logs})

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
                for m in config.get("miners", []):
                    for k, v in params.items(): m[k] = v
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
