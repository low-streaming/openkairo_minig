import logging
import json
import os
import time
import asyncio
import pydantic
from datetime import datetime, timedelta
import homeassistant.util.dt as dt_util

# Pydantic Fix für pyasic unter Python 3.14 (Home Assistant 2024.x)
try:
    pydantic.BaseModel.model_config = {"arbitrary_types_allowed": True}
except Exception:
    pass

from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components.http import HomeAssistantView
from homeassistant.const import EVENT_HOMEASSISTANT_START, Platform

DOMAIN = "openkairo_mining"
_LOGGER = logging.getLogger(__name__)

CONFIG_FILE = "openkairo_mining_config.json"

PLATFORMS: list[Platform] = [
    Platform.SENSOR,
    Platform.SWITCH,
    Platform.BINARY_SENSOR,
    Platform.NUMBER,
    Platform.SELECT,
]

from homeassistant.components.frontend import async_register_built_in_panel, async_remove_panel

async def async_setup(hass: HomeAssistant, config: dict):
    # Ensure pyasic is installed before anything else
    from .patch import ensure_pyasic
    await hass.async_add_executor_job(ensure_pyasic)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    _LOGGER.info(f"Setting up OpenKairo Mining Integration: {entry.title}")
    
    # Reload pyasic if needed
    from .patch import ensure_pyasic
    await hass.async_add_executor_job(ensure_pyasic)
    
    hass.data.setdefault(DOMAIN, {})
    
    # Check if this entry contains IP address (meaning it's a hardware ASIC config)
    if "ip_address" in entry.data:
        # Load hardware platforms (sensor, switch, etc.) for this miner
        hass.data[DOMAIN].setdefault("miners", {})
        hass.data[DOMAIN]["miners"][entry.entry_id] = entry.data
        
        # We need to ensure the coordinators dict exists
        hass.data[DOMAIN].setdefault("coordinators", {})
        
        # [NEW] Sync with internal dashboard config
        async def sync_with_config():
            from .__init__ import _load_config, _save_config
            config = await hass.async_add_executor_job(_load_config, hass)
            
            ip = entry.data["ip_address"]
            safe_ip = ip.replace('.', '_')
            domain = DOMAIN
            
            # Auto-generate entity IDs based on the integration naming convention
            auto_entities = {
                "switch":                  f"switch.{domain}_{safe_ip}_mining_aktiv",
                "power_entity":            f"number.{domain}_{safe_ip}_power_limit",
                "hashrate_sensor":         f"sensor.{domain}_{safe_ip}_hashrate",
                "temp_sensor":             f"sensor.{domain}_{safe_ip}_temperature",
                "power_consumption_sensor": f"sensor.{domain}_{safe_ip}_power",
            }
            
            # Check if this IP is already in the dashboard config
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
                _LOGGER.info(f"Added miner {entry.title} ({ip}) to dashboard config with auto-entities")
            else:
                # Update existing entry: only fill in if fields are completely MISSING
                # DO NOT overwrite existing values, even if they look like legacy ones, 
                # as the user might have manually pointed them to something else.
                miner = config["miners"][existing_idx]
                changed = False
                for key, val in auto_entities.items():
                    if key not in miner or not miner.get(key):
                        miner[key] = val
                        changed = True
                if changed:
                    config["miners"][existing_idx] = miner
                    await hass.async_add_executor_job(_save_config, hass, config)
                    _LOGGER.info(f"Fixed missing entity references for {entry.title} ({ip})")

        hass.async_create_task(sync_with_config())

        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
        return True
    
    # If no IP is in data, this is the main Dashboard entry (Zentrale)
    hass.data[DOMAIN]["config"] = await hass.async_add_executor_job(_load_config, hass)
    hass.data[DOMAIN]["entry_id"] = entry.entry_id
    hass.data[DOMAIN].setdefault("coordinators", {})
    
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="OpenKairo Mining",
        sidebar_icon="mdi:lightning-bolt",
        frontend_url_path="openkairo_mining",
        config={
            "_panel_custom": {
                "name": "openkairo-mining-panel",
                "module_url": f"/api/{DOMAIN}/frontend/openkairo-mining-panel.js?v=1.3.19"
            }
        },
        require_admin=True
    )

    hass.http.register_view(OpenKairoMiningFrontendView())
    hass.http.register_view(OpenKairoMiningApiView())
    
    # Setup hardware services
    from .services import async_setup_services
    await async_setup_services(hass)

    if not hass.data[DOMAIN].get("loop_started"):
        hass.data[DOMAIN]["loop_started"] = True
        if hass.is_running:
            hass.loop.create_task(_mining_loop(hass))
        else:
            hass.bus.async_listen_once(EVENT_HOMEASSISTANT_START, lambda event: hass.loop.create_task(_mining_loop(hass)))
    
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload a config entry."""
    if "ip_address" in entry.data:
        # Unload ASIC hardware platforms
        unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
        if unload_ok and entry.entry_id in hass.data[DOMAIN].get("miners", {}):
            hass.data[DOMAIN]["miners"].pop(entry.entry_id)
        return unload_ok

    # Unload Main Dashboard
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
                if "miners" not in data: # migrate old config
                    return {"miners": []}
                return data
            except Exception as e:
                _LOGGER.error(f"Error loading OpenKairo Mining config: {e}")
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
            content = await hass.async_add_executor_job(
                lambda: open(path, "r", encoding="utf-8").read()
            )
            from aiohttp import web
            return web.Response(body=content, content_type="application/javascript")
        except Exception as e:
            _LOGGER.error(f"Error serving OpenKairo Mining frontend: {e}")
            from aiohttp import web
            return web.Response(status=404)

class OpenKairoMiningApiView(HomeAssistantView):
    url = f"/api/{DOMAIN}/data"
    name = f"api:{DOMAIN}:data"
    requires_auth = False

    async def get(self, request):
        hass = request.app["hass"]
        config = hass.data.get(DOMAIN, {}).get("config", {"miners": []})
        states = hass.data.get(DOMAIN, {}).get("miner_states", {})
        
        # Check for 'short' or 'display' parameter to save bandwidth/CPU for ESP32
        is_short = request.query.get("short") == "1" or request.query.get("display") == "1"

        # Sterilize config: Remove large image data for display devices
        if is_short:
            clean_config = {"miners": []}
            for m in config.get("miners", []):
                clean_miner = {k: v for k, v in m.items() if k != "image"}
                clean_config["miners"].append(clean_miner)
            config = clean_config

        # Sterilize states (remove large objects if any)
        clean_states = {}
        for mid, s in states.items():
            clean_s = {k: v for k, v in s.items() if k != "active_ramping_task"}
            
            # [NEW] Calculate remaining watchdog time for API
            wd_start = s.get("standby_since")
            clean_s["watchdog_remaining"] = 0 # Default
            if wd_start:
                try:
                    # Find miner in config to get delay
                    m_cfg = next((m for m in config.get("miners", []) if m.get("id") == mid or m.get("miner_ip") == mid), {})
                    if m_cfg.get("standby_watchdog_enabled"):
                        delay_secs = float(m_cfg.get("standby_delay", 10)) * 60
                        rem = int(max(0, delay_secs - (time.time() - wd_start)))
                        clean_s["watchdog_remaining"] = rem
                except Exception as e:
                    _LOGGER.debug(f"WD calc error for {mid}: {e}")
                
            # [NEW] Determine precise status for UI
            sw_on = s.get("is_on", False)
            is_mining = s.get("is_mining", False)
            ramping = s.get("ramping") # 'up' or 'down'
            
            # Find miner config
            m_cfg = next((m for m in config.get("miners", []) if m.get("id") == mid or m.get("miner_ip") == mid), {})
            
            now = time.time()
            on_for_secs = (now - s.get("on_since_actual", 0)) if s.get("on_since_actual") else 0
            min_run_secs = float(m_cfg.get("min_run_time", 5)) * 60
            
            # Check Grid Price
            grid_active = False
            price_sensor = m_cfg.get("electricity_price_sensor")
            price_limit = m_cfg.get("grid_price_limit")
            if price_sensor and price_limit is not None:
                p_state = hass.states.get(price_sensor)
                if p_state and p_state.state not in ["unknown", "unavailable"]:
                    try:
                        if float(p_state.state) <= float(price_limit):
                            grid_active = True
                    except: pass

            if not sw_on:
                clean_s["status_msg"] = "AUS"
            elif ramping == "up":
                clean_s["status_msg"] = "SOFT-UP"
            elif ramping == "down":
                clean_s["status_msg"] = "SOFT-DN"
            elif sw_on and not is_mining:
                clean_s["status_msg"] = "STANDBY"
            elif is_mining:
                # Priority for status msg: MIN-RUN > CH-GRID > MINING
                # Check if we are in protection window (Min-Run)
                if on_for_secs < min_run_secs and s.get("on_since_actual"):
                    # We only label it MIN-RUN if it would normally be OFF. 
                    # But for now, let's keep it simple: Protection is active.
                    clean_s["status_msg"] = "MIN-RUN"
                elif grid_active:
                    clean_s["status_msg"] = "CH-GRID"
                else:
                    clean_s["status_msg"] = "MINING"
                
            clean_states[mid] = clean_s
            
        mempool = {
            "fees": hass.data.get(DOMAIN, {}).get("mempool_fees"),
            "height": hass.data.get(DOMAIN, {}).get("mempool_height"),
            "halving": hass.data.get(DOMAIN, {}).get("mempool_halving")
        }
        
        # [NEW] BTC Price & Global SOC
        btc_price = hass.data.get(DOMAIN, {}).get("btc_price", 0)
        
        global_soc = 0
        for m in config.get("miners", []):
            bat_sensor = m.get("battery_sensor")
            if bat_sensor:
                s = hass.states.get(bat_sensor)
                if s and s.state not in ["unknown", "unavailable"]:
                    try:
                        global_soc = float(s.state)
                        break
                    except: pass

        # [NEW] Skip logs if short mode
        logs = [] if is_short else hass.data.get(DOMAIN, {}).get("logs", [])

        from aiohttp import web
        return web.json_response({
            "status": "ok", 
            "config": config, 
            "states": clean_states, 
            "mempool": mempool, 
            "btc_price": btc_price,
            "soc": global_soc,
            "logs": logs
        })

    
    async def post(self, request):
        hass = request.app["hass"]
        try:
            data = await request.json()
            
            # [NEW] Handle remote actions from Display/Dashboard
            if "action" in data:
                action = data["action"]
                config = hass.data.get(DOMAIN, {}).get("config", {"miners": []})
                for m in config.get("miners", []):
                    ip = m.get("miner_ip")
                    if not ip: continue
                    if action == "restart":
                        await hass.services.async_call(DOMAIN, "restart_backend", {"ip_address": ip})
                    elif action == "reboot":
                        await hass.services.async_call(DOMAIN, "reboot", {"ip_address": ip})
                from aiohttp import web
                return web.json_response({"status": "success", "action": action})

            # [NEW] Handle specific miner config updates (e.g. SOC values)
            if "update_miner_config" in data:
                mid = data["update_miner_config"]
                params = data.get("params", {})
                config = hass.data.get(DOMAIN, {}).get("config", {"miners": []})
                for m in config.get("miners", []):
                    if m.get("id") == mid or m.get("miner_ip") == mid:
                        for key, val in params.items():
                            m[key] = val
                        break
                await hass.async_add_executor_job(_save_config, hass, config)
                from aiohttp import web
                return web.json_response({"status": "success", "updated": mid})

            # [NEW] Handle global config updates for all miners
            if "update_global_config" in data:
                params = data.get("params", {})
                config = hass.data.get(DOMAIN, {}).get("config", {"miners": []})
                for m in config.get("miners", []):
                    for key, val in params.items():
                        m[key] = val
                await hass.async_add_executor_job(_save_config, hass, config)
                from aiohttp import web
                return web.json_response({"status": "success", "updated": "all"})

            # Default: Save the entire config
            await hass.async_add_executor_job(_save_config, hass, data)
            new_config = await hass.async_add_executor_job(_load_config, hass)
            hass.data[DOMAIN]["config"] = new_config
            
            from aiohttp import web
            return web.json_response({"status": "ok", "message": "Konfiguration gespeichert"})
        except Exception as e:
            _LOGGER.error(f"Error in API POST: {e}")
            from aiohttp import web
            return web.json_response({"status": "error", "message": str(e)}, status=500)

async def get_avg_night_load(hass, entity_id, days=3):
    """Calculates the average night load (22:00 - 06:00) of a sensor over the last few days."""
    try:
        from homeassistant.components.recorder import history
        
        end_time = dt_util.utcnow()
        start_time = end_time - timedelta(days=days)
        
        all_states = await hass.async_add_executor_job(
            history.state_changes_during_period,
            hass,
            start_time,
            end_time,
            entity_id
        )
        
        states = all_states.get(entity_id, [])
        if not states:
            return 0
            
        total_p = 0
        count = 0
        for s in states:
            if s.state in ["unknown", "unavailable", None]:
                continue
            
            local_dt = dt_util.as_local(s.last_changed)
            if local_dt.hour >= 22 or local_dt.hour < 6:
                try:
                    val = abs(float(s.state))
                    # Ignore values < 10W (Likely standby or noise)
                    if val > 10:
                        total_p += val
                        count += 1
                except: pass
                                
        return total_p / count if count > 0 else 0
    except Exception as e:
        _LOGGER.error(f"Error calculating AI history for {entity_id}: {e}")
        return 0


async def get_solar_forecast(hass):
    """Fetches solar radiation forecast from Open-Meteo based on HA location."""
    try:
        lat = hass.config.latitude
        lon = hass.config.longitude
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=shortwave_radiation_sum&timezone=auto&shortwave_radiation_unit=mj_per_m_square"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if "daily" in data and "shortwave_radiation_sum" in data["daily"]:
                        # Index 0 is today, Index 1 is tomorrow
                        rad_tomorrow = data["daily"]["shortwave_radiation_sum"][1]
                        
                        # Sanity Check: Wenn der Wert > 500 ist, ist es vermutlich Wh/m2 statt MJ/m2
                        if rad_tomorrow > 500:
                            rad_tomorrow = rad_tomorrow * 0.0036 # Wh/m2 zu MJ/m2
                        elif rad_tomorrow > 100: # Immer noch zu hoch für MJ/m2 (evtl. kJ/m2)
                             rad_tomorrow = rad_tomorrow / 1000 # kJ/m2 zu MJ/m2
                             
                        return float(rad_tomorrow)
    except Exception as e:
        _LOGGER.error(f"Error fetching solar forecast: {e}")
    return None



def _add_log_entry(hass, message):
    if DOMAIN not in hass.data:
        return
    if "logs" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["logs"] = []
    
    timestamp = time.strftime("%H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    
    hass.data[DOMAIN]["logs"].insert(0, log_entry)
    # Keep only last 100 entries
    hass.data[DOMAIN]["logs"] = hass.data[DOMAIN]["logs"][:100]
    _LOGGER.info(f"[OpenKairo Log] {message}")


async def _mining_loop(hass):
    _LOGGER.info("Starting OpenKairo Mining background loop")
    while True:
        try:
            # Mempool Daten alle 10 Minuten aktualisieren
            current_time = time.time()
            last_update = hass.data.get(DOMAIN, {}).get("mempool_last_update", 0)
            if current_time - last_update > 600:
                await _update_mempool_data(hass)

            config = hass.data.get(DOMAIN, {}).get("config", {})

            miners = config.get("miners", [])
            
            # Nach Priorität sortieren (1 = höchste Priorität)
            sorted_miners = sorted(miners, key=lambda x: int(x.get("priority", 99)))
            
            # [NEU] Globaler Überschuss-Tracker (für Balancing mehrere Miner)
            global_pv_surplus = None 
            
            for miner in sorted_miners:
                miner_id = str(miner.get("id", miner.get("name", "Unknown")))
                if "miner_states" not in hass.data[DOMAIN]:
                    hass.data[DOMAIN]["miner_states"] = {}
                miner_states = hass.data[DOMAIN]["miner_states"]
                if miner_id not in miner_states:
                    miner_states[miner_id] = {
                        "on_since": None, 
                        "off_since": None, 
                        "standby_since": None,
                        "last_sensor_update": current_time
                    }
                
                state = miner_states[miner_id]
                current_time = time.time()
                
                mode = miner.get("mode", "manual")
                miner_name = miner.get("name", "Unknown Miner")
                miner_ip = miner.get("miner_ip")
                
                # --- Smart Switch Discovery ---
                miner_switch = miner.get("switch")
                miner_switch_2 = miner.get("switch_2")
                if not miner_switch and miner_ip:
                    safe_ip = miner_ip.replace('.', '_')
                    # List of patterns to try
                    patterns = [
                        f"switch.{DOMAIN}_{safe_ip}_switch",
                        f"switch.{DOMAIN}_{safe_ip}_mining_aktiv",
                        f"switch.{safe_ip}_mining_aktiv"
                    ]
                    for p in patterns:
                        if hass.states.get(p):
                            miner_switch = p
                            break
                    if not miner_switch:
                         miner_switch = patterns[0] # Fallback
                
                switches = [miner_switch]
                if miner_switch_2:
                    switches.append(miner_switch_2)
                
                # --- State Detection ---
                # 1. Hardware-Check: Ist die Steckdose überhaupt an?
                plug_on = True
                standby_plug = miner.get("standby_switch")
                if standby_plug:
                    p_state = hass.states.get(standby_plug)
                    if p_state and p_state.state == "off":
                        plug_on = False

                # 2. Basis-Check: Sind alle konfigurierten Schalter an?
                is_on = all(hass.states.get(s).state == "on" if hass.states.get(s) else False for s in switches)
                
                # Wenn der Stecker aus ist, ist der Miner AUS!
                if not plug_on:
                    is_on = False
                
                state["is_on"] = is_on

                # Erweiterter Check: Wenn der Miner Strom verbraucht (> 50W), behandeln wir ihn als EIN.
                p_sensor = miner.get("power_consumption_sensor")
                if not is_on and p_sensor:
                    p_state = hass.states.get(p_sensor)
                    if p_state and p_state.state not in ["unknown", "unavailable"]:
                        try:
                            if float(p_state.state) > 50:
                                is_on = True
                                _LOGGER.debug(f"[{miner_name}] Schalter ist AUS, aber Stromverbrauch erkannt ({p_state.state}W). Behandle als EIN.")
                        except (ValueError, TypeError):
                            pass

                # --- Coordinator / Data Sync ---
                coord = None
                if miner_ip:
                    from .coordinator import async_get_miner_coordinator
                    coord = await async_get_miner_coordinator(hass, DOMAIN, miner_ip, miner_name, miner.get("miner_user"), miner.get("miner_password"))
                    try:
                        if coord and coord.data:
                            sensors = coord.data.get("miner_sensors", {})
                            state["hashrate"] = sensors.get("hashrate", 0)
                            state["power"] = sensors.get("miner_consumption", 0)
                            state["temp"] = sensors.get("temperature", 0)
                            state["is_mining"] = coord.data.get("is_mining", False)
                        else:
                            state["hashrate"] = 0
                            state["power"] = 0
                            state["is_mining"] = False
                    except Exception as data_err:
                        _LOGGER.debug(f"[{miner_name}] Error syncing dashboard data: {data_err}")

                # Standby-Watchdog (for all modes)
                if miner.get("standby_watchdog_enabled"):
                    watchdog_type = miner.get("watchdog_type", "power")
                    # Wähle das Ziel-Objekt basierend auf dem Typ
                    target_entity = miner.get("power_entity") if watchdog_type == "limit" else miner.get("power_consumption_sensor")
                    standby_switches = []
                    if miner.get("standby_switch"):
                        standby_switches.append(miner.get("standby_switch"))
                    if miner.get("standby_switch_2"):
                        standby_switches.append(miner.get("standby_switch_2"))
                    
                    if target_entity and standby_switches:
                        target_state = hass.states.get(target_entity)
                        # Prüfe ob mindestens einer der Schalter AN ist (sonst ist der Watchdog ggf. schon durch)
                        any_on = any(hass.states.get(s).state == "on" if hass.states.get(s) else False for s in standby_switches)
                        
                        if target_state and target_state.state not in ["unknown", "unavailable"] and any_on:
                            try:
                                current_value = float(target_state.state)
                                standby_threshold = float(miner.get("standby_power", 100))
                                standby_delay_mins = float(miner.get("standby_delay", 10))
                                standby_delay_secs = standby_delay_mins * 60
                                
                                if current_value < standby_threshold and is_on:
                                    if state.get("standby_since") is None:
                                        state["standby_since"] = current_time
                                        msg = f"Watchdog Countdown gestartet: {current_value}W < {standby_threshold}W (Warte {standby_delay_mins} Min)"
                                        _LOGGER.info(f"[{miner_name}] {msg}")
                                        _add_log_entry(hass, f"🛡️ {miner_name}: {msg}")
                                    elif current_time - state["standby_since"] >= standby_delay_secs:
                                        msg = f"Watchdog an {miner_name} ausgelöst ({watchdog_type})! Wert {current_value} zu niedrig. Schalte Steckdose AUS."
                                        _LOGGER.warning(f"[{miner_name}] {msg}")
                                        _add_log_entry(hass, f"🛡️ {msg}")
                                        if standby_switches:
                                            await hass.services.async_call("switch", "turn_off", {"entity_id": standby_switches}, blocking=False)
                                        else:
                                            _LOGGER.error(f"[{miner_name}] Watchdog triggered but NO switches configured!")
                                        state["standby_since"] = None
                                else:
                                    # Reset watchdog if value is OK or miner was intentionally turned OFF
                                    if state.get("standby_since") is not None:
                                        _LOGGER.debug(f"[{miner_name}] Watchdog Reset (Wert ok oder Miner absichtlich AUS)")
                                    state["standby_since"] = None
                            except ValueError:
                                state["standby_since"] = None
                        else:
                            # Reset watchdog if plug is off or sensor unavailable
                            state["standby_since"] = None

                if mode in ["pv", "soc", "offgrid", "heating", "ai_discharge"]:
                    delay_minutes = float(miner.get("delay_minutes", 0))
                    delay_seconds = delay_minutes * 60
                    
                    turn_on_condition = False
                    turn_off_condition = False

                    if mode == "pv":
                        pv_sensor = miner.get("pv_sensor")
                        if pv_sensor:
                            pv_state = hass.states.get(pv_sensor)
                            if pv_state and pv_state.state not in ["unknown", "unavailable"]:
                                state["last_sensor_update"] = current_time
                                try:
                                    pv_value = float(pv_state.state)
                                    on_threshold = float(miner.get("pv_on", 1000))
                                    off_threshold = float(miner.get("pv_off", 500))
                                    
                                    battery_min_soc = float(miner.get("battery_min_soc", 100))
                                    allow_battery = miner.get("allow_battery", False)
                                    
                                    # [NEU] Global Surplus Balancing
                                    if global_pv_surplus is None:
                                        global_pv_surplus = pv_value
                                    
                                    effective_pv = global_pv_surplus
                                    
                                    battery_soc = 0
                                    # ... (rest of SOC/Battery logic)
                                    if allow_battery and battery_sensor:
                                        bat_state = hass.states.get(battery_sensor)
                                        if bat_state and bat_state.state not in ["unknown", "unavailable"]:
                                            battery_soc = float(bat_state.state)
                                    
                                    if effective_pv >= on_threshold:
                                        # SOC Hysterese: Zum Einschalten muessen es 2% ueber dem Limit sein
                                        safety_min_soc = battery_min_soc + 2 if not is_on else battery_min_soc
                                        if not allow_battery or (allow_battery and battery_soc >= safety_min_soc):
                                            turn_on_condition = True
                                            state["log_reason_on"] = f"(PV {effective_pv}W >= {on_threshold}W" + (f", SOC {battery_soc}% >= {safety_min_soc}%)" if allow_battery else ")")
                                    
                                    # [NEU] Grid Price Awareness (Tibber/Awattar)
                                    price_sensor = miner.get("electricity_price_sensor")
                                    price_limit = miner.get("grid_price_limit")
                                    if price_sensor and price_limit is not None:
                                        p_state = hass.states.get(price_sensor)
                                        if p_state and p_state.state not in ["unknown", "unavailable"]:
                                            try:
                                                cur_price = float(p_state.state)
                                                if cur_price <= float(price_limit):
                                                    turn_on_condition = True
                                                    state["log_reason_on"] = f"(Günstiger Netzpreis: {cur_price} <= {price_limit})"
                                            except: pass

                                    # Wetter-Vorhersage Check (Optional)
                                    forecast_enabled = miner.get("forecast_enabled", True)
                                    forecast_sensor = miner.get("forecast_sensor")
                                    forecast_min = float(miner.get("forecast_min", 0))
                                    if forecast_enabled and forecast_sensor and turn_on_condition:
                                        f_state = hass.states.get(forecast_sensor)
                                        if f_state and f_state.state not in ["unknown", "unavailable"]:
                                            try:
                                                if float(f_state.state) < forecast_min:
                                                    turn_on_condition = False # Prognose zu schlecht
                                                else:
                                                    _LOGGER.debug(f"[PV] Forecast ok ({float(f_state.state)} >= {forecast_min})")
                                            except ValueError:
                                                pass

                                    if pv_value <= off_threshold:
                                        if not allow_battery or (allow_battery and battery_soc < battery_min_soc):
                                            turn_off_condition = True
                                            state["log_reason_off"] = f"(PV {pv_value}W <= {off_threshold}W" + (f", SOC {battery_soc}% < {battery_min_soc}%)" if allow_battery else ")")
                                            
                                except ValueError:
                                    pass
                    elif mode == "soc":
                        battery_sensor = miner.get("battery_sensor")
                        if battery_sensor:
                            bat_state = hass.states.get(battery_sensor)
                            if bat_state and bat_state.state not in ["unknown", "unavailable"]:
                                state["last_sensor_update"] = current_time
                                try:
                                    battery_soc = float(bat_state.state)
                                    soc_on = float(miner.get("soc_on", 90))
                                    soc_off = float(miner.get("soc_off", 30))
                                    
                                    if battery_soc >= soc_on:
                                        turn_on_condition = True
                                        state["log_reason_on"] = f"(SOC {battery_soc}% >= {soc_on}%)"
                                    elif battery_soc <= soc_off:
                                        turn_off_condition = True
                                        state["log_reason_off"] = f"(SOC {battery_soc}% <= {soc_off}%)"
                                except ValueError:
                                    pass
                    elif mode == "heating":
                        temp_sensor = miner.get("target_temp_sensor")
                        if temp_sensor:
                            t_state = hass.states.get(temp_sensor)
                            if t_state and t_state.state not in ["unknown", "unavailable"]:
                                state["last_sensor_update"] = current_time
                                try:
                                    current_temp = float(t_state.state)
                                    temp_on = float(miner.get("target_temp_on", 21.0))
                                    temp_off = float(miner.get("target_temp_off", 22.0))
                                    
                                    # [NEU] Batterie SOC Abhängigkeit
                                    allow_battery = miner.get("allow_battery", False)
                                    battery_sensor = miner.get("battery_sensor")
                                    battery_min_soc = float(miner.get("battery_min_soc", 100))
                                    battery_soc = 100 # Default für Logik falls deaktiviert
                                    
                                    if allow_battery and battery_sensor:
                                        bat_state = hass.states.get(battery_sensor)
                                        if bat_state and bat_state.state not in ["unknown", "unavailable"]:
                                            battery_soc = float(bat_state.state)
                                        else:
                                            battery_soc = -1 # Sensor-Fehler
                                    
                                    if current_temp <= temp_on:
                                        # SOC Hysterese: Zum Einschalten muessen es 2% ueber dem Limit sein
                                        safety_min_soc = battery_min_soc + 2 if not is_on else battery_min_soc
                                        if not allow_battery or (allow_battery and battery_soc >= safety_min_soc):
                                            turn_on_condition = True
                                            state["log_reason_on"] = f"(Temp {current_temp}°C <= {temp_on}°C" + (f", SOC {battery_soc}% >= {safety_min_soc}%)" if allow_battery else ")")
                                        else:
                                            _LOGGER.debug(f"[{miner_name}] Heizen blockiert: SOC {battery_soc}% < {safety_min_soc}%")

                                    elif current_temp >= temp_off:
                                        turn_off_condition = True
                                        state["log_reason_off"] = f"(Temp {current_temp}°C >= {temp_off}°C)"
                                        
                                    if allow_battery and 0 <= battery_soc < battery_min_soc:
                                        turn_off_condition = True
                                        state["log_reason_off"] = f"(Heiz-Stopp: SOC {battery_soc}% < {battery_min_soc}%)"
                                        
                                except ValueError:
                                    pass
                    elif mode == "offgrid":
                        battery_sensor = miner.get("battery_sensor")
                        if battery_sensor:
                            bat_state = hass.states.get(battery_sensor)
                            if bat_state and bat_state.state not in ["unknown", "unavailable"]:
                                state["last_sensor_update"] = current_time
                                try:
                                    battery_soc = float(bat_state.state)
                                    soc_start = float(miner.get("offgrid_soc_start", 90))
                                    soc_stop = float(miner.get("offgrid_soc_stop", 85))
                                    
                                    if battery_soc >= soc_start:
                                        turn_on_condition = True
                                        state["log_reason_on"] = f"(Offgrid SOC {battery_soc}% >= Start {soc_start}%)"
                                    elif battery_soc <= soc_stop:
                                        turn_off_condition = True
                                        state["log_reason_off"] = f"(Offgrid SOC {battery_soc}% <= Stop {soc_stop}%)"
                                except ValueError:
                                    pass
                                    
                    elif mode == "ai_discharge":
                        # KI-gesteuerte Entladung (Leert den Akku bis zum Morgen)
                        battery_sensor = miner.get("battery_sensor")
                        # Wir nutzen bevorzugt einen dedizierten Batteriesensor (W), sonst Hausverbrauch
                        power_sensor = miner.get("battery_power_sensor") or miner.get("power_consumption_sensor")
                        
                        capacity = float(miner.get("battery_capacity", 10)) # kWh
                        target_soc = float(miner.get("target_soc", 10)) # %
                        target_time_str = miner.get("target_time", "07:00")
                        
                        if not battery_sensor:
                            state["ai_status"] = "Konfigurationsfehler: Hausakku SOC-Sensor fehlt"
                        elif not power_sensor:
                            state["ai_status"] = "Konfigurationsfehler: Stromverbrauch-Sensor fehlt"
                        else:
                            bat_state = hass.states.get(battery_sensor)
                            if not bat_state:
                                state["ai_status"] = f"Sensor nicht gefunden: {battery_sensor}"
                            elif bat_state.state in ["unknown", "unavailable"]:
                                state["ai_status"] = f"Sensor {battery_sensor} offline"
                            else:
                                state["last_sensor_update"] = current_time
                                try:
                                    current_soc = float(bat_state.state)
                                    state["ai_status"] = "Berechnung aktiv..."
                                    
                                    # Historischen Nachtverbrauch prüfen (Cache für 1 Std)
                                    cache_key = f"ai_load_{power_sensor}"
                                    last_cache = hass.data[DOMAIN].get(f"{cache_key}_time", 0)
                                    if current_time - last_cache > 3600:
                                        # Wir führen das im Hintergrund aus, um den Loop nicht zu blockieren
                                        async def fetch_history():
                                            load = await get_avg_night_load(hass, power_sensor)
                                            hass.data[DOMAIN][cache_key] = load
                                            hass.data[DOMAIN][f"{cache_key}_time"] = time.time()
                                        hass.async_create_task(fetch_history())
                                    
                                    avg_load = hass.data[DOMAIN].get(cache_key)
                                    if avg_load is None:
                                        avg_load = 250 # Fallback 250W solange kein Wert da ist
                                    state["ai_status"] = "Warte auf Historie (Nutze 250W Fallback)..."
                                    
                                    # Wetter-Optimierung (Optional)
                                    weather_enabled = miner.get("weather_optimization_enabled", False)
                                    weather_info = ""
                                    if weather_enabled:
                                        cache_key = "solar_forecast_v2"
                                        last_cache = hass.data[DOMAIN].get(f"{cache_key}_time", 0)
                                        if time.time() - last_cache > 3600:
                                            async def fetch_solar():
                                                rad = await get_solar_forecast(hass)
                                                if rad is not None:
                                                    hass.data[DOMAIN][cache_key] = rad
                                                    hass.data[DOMAIN][f"{cache_key}_time"] = time.time()
                                            hass.async_create_task(fetch_solar())
                                        
                                        forecast_rad = hass.data[DOMAIN].get(cache_key)
                                        if forecast_rad is not None:
                                            if forecast_rad > 18:
                                                target_soc = max(0, target_soc - 5)
                                                weather_info = f" (Sonne morgen: {int(forecast_rad)} MJ/m²! Ziel -5%)"
                                            elif forecast_rad < 5:
                                                target_soc = min(100, target_soc + 5)
                                                weather_info = f" (Trüb morgen: {int(forecast_rad)} MJ/m²! Ziel +5%)"
                                            else:
                                                weather_info = f" (Wetter: {int(forecast_rad)} MJ/m²)"
                                        else:
                                            weather_info = " (Wetterdaten laden...)"
                                    
                                    # Ziel-Uhrzeit berechnen
                                    now = dt_util.now()
                                    try:
                                        if ':' in target_time_str:
                                            parts = target_time_str.split(':')
                                            t_hour = int(parts[0])
                                            t_min = int(parts[1])
                                        else:
                                            t_hour, t_min = 7, 0
                                    except:
                                        t_hour, t_min = 7, 0
                                        
                                    target_dt = now.replace(hour=t_hour, minute=t_min, second=0, microsecond=0)
                                    if target_dt <= now:
                                        target_dt += timedelta(days=1)
                                    
                                    hours_left = (target_dt - now).total_seconds() / 3600
                                    
                                    # Erwarteter Energiebedarf Haus (Wh)
                                    house_energy_needed = avg_load * hours_left
                                    
                                    # Verfügbare Energie im Akku bis Ziel-SOC (Wh)
                                    battery_energy_available = max(0, (current_soc - target_soc) / 100 * capacity * 1000)
                                    
                                    # Restenergie zum Minen (Wh)
                                    mining_energy_available = battery_energy_available - house_energy_needed
                                    
                                    miner_power = 1200 # Default
                                    cfg_power = miner.get("soft_target_power")
                                    p_sensor_val = 0
                                    p_sensor_entity = miner.get("power_consumption_sensor")
                                    if p_sensor_entity:
                                        p_s = hass.states.get(p_sensor_entity)
                                        if p_s and p_s.state not in ["unknown", "unavailable"]:
                                            try: p_sensor_val = float(p_s.state)
                                            except: pass
                                    
                                    if is_on and p_sensor_val > 5:
                                        miner_power = p_sensor_val
                                    elif cfg_power:
                                        miner_power = float(cfg_power)
                                    else:
                                        miner_power = 18 if "nerd" in miner_name.lower() else 1200
                                    
                                    if mining_energy_available <= 0:
                                        turn_off_condition = True
                                        state["log_reason_off"] = f"(AI: Keine Reserve - Haus braucht {int(house_energy_needed)}Wh, Akku hat {int(battery_energy_available)}Wh)"
                                        state["ai_start_time"] = "--:--"
                                        state["ai_runtime"] = 0
                                        state["ai_status"] = f"Hausbedarf ({int(house_energy_needed)}Wh) > Akku ({int(battery_energy_available)}Wh)"
                                    else:
                                        runtime_hours = mining_energy_available / miner_power
                                        runtime_hours = min(runtime_hours, hours_left)
                                        
                                        start_time_dt = target_dt - timedelta(hours=runtime_hours)
                                        
                                        # Startzeit nur aktualisieren wenn wir noch warten
                                        if not is_on or not state.get("ai_start_time"):
                                            state["ai_start_time"] = start_time_dt.strftime("%H:%M")
                                        
                                        state["ai_runtime"] = round(runtime_hours, 1)
                                        
                                        if now >= start_time_dt:
                                            turn_on_condition = True
                                            state["ai_status"] = f"Aktiv bis {target_time_str}{weather_info}"
                                            state["log_reason_on"] = f"(AI Startzeit erreicht: {state['ai_start_time']})"
                                        else:
                                            turn_off_condition = True
                                            state["ai_status"] = f"Start geplant um {state['ai_start_time']} Uhr{weather_info}"
                                            state["log_reason_off"] = f"(AI Wartet auf Startzeit: {state['ai_start_time']})"
                                            
                                except Exception as ai_err:
                                    _LOGGER.error(f"AI Discharge Error for {miner_name}: {ai_err}")
                                    state["ai_status"] = f"Berechnungsfehler: {str(ai_err)[:30]}"
                    
                    # --- SENSOR WATCHDOG ---
                    # Wenn seit 5 Minuten keine gueltigen Sensordaten kamen -> Abschalten!
                    # Nur ausführen wenn wir in einem Automatik-Modus sind!
                    if mode in ["pv", "soc", "offgrid", "heating", "ai_discharge"] and current_time - state.get("last_sensor_update", current_time) > 300:
                        _LOGGER.warning(f"[{miner_name}] Sensor-Timeout (>5 Min)! Schalte sicherheitshalber AB.")
                        turn_on_condition = False
                        turn_off_condition = True
                        state["log_reason_off"] = "(Sicherheits-Stopp: Sensor-Daten veraltet/tot)"

                    # Apply Hysterese and Ramping
                    if turn_on_condition:
                        # Abort shutdown if we are currently ramping down
                        if state.get("ramping") == "down":
                            state["ramping"] = None
                            state["off_since"] = None
                            _LOGGER.info(f"[{miner_name}] Shutdown abgebrochen, da Einschalt-Bedingung wieder erfüllt ist.")

                        if is_on or state.get("ramping") == "up":
                            state["on_since"] = None
                        elif state["on_since"] is None:
                            state["on_since"] = current_time
                        elif current_time - state["on_since"] >= delay_seconds or state["hashrate"] > 0 or state["power"] > 200:
                            
                            # [NEU] Surplus vom globalen Pool abziehen für nächste Miner
                            if global_pv_surplus is not None:
                                estimated_p = float(miner.get("soft_target_power", 1200))
                                global_pv_surplus -= estimated_p
                                _LOGGER.debug(f"[Balancing] {miner_name} reserviert {estimated_p}W. Verbleibender Überschuss: {global_pv_surplus}W")

                            # [NEU] Direktes Einschalten via Hardware-Treiber (Bypass HA Switches)
                            if coord and coord.miner_obj:
                                try:
                                    _LOGGER.info(f"[{miner_name}] Direktes Einschalten via API (Resume)")
                                    await coord.miner_obj.resume_mining()
                                    if not state.get("on_since_actual"):
                                        state["on_since_actual"] = current_time
                                except Exception as e:
                                    _LOGGER.error(f"[{miner_name}] API Einschalten fehlgeschlagen: {e}")

                            # Standby-Switch (Hard Plug) automatically turn ON if it was hard-off
                            if miner.get("standby_watchdog_enabled"):
                                standby_switches = []
                                if miner.get("standby_switch"): standby_switches.append(miner.get("standby_switch"))
                                if miner.get("standby_switch_2"): standby_switches.append(miner.get("standby_switch_2"))

                                if standby_switches:
                                    any_off = any(hass.states.get(s).state == "off" if hass.states.get(s) else False for s in standby_switches)
                                    if any_off:
                                        msg = f"Watchdog-Erholung für {miner_name}: Schalte Steckdose(n) wieder EIN."
                                        _LOGGER.info(f"[{miner_name}] {msg}")
                                        _add_log_entry(hass, f"🛡️ {msg}")
                                        await hass.services.async_call("switch", "turn_on", {"entity_id": standby_switches}, blocking=False)
                            
                            if not is_on and state.get("ramping") != "up":
                                if miner.get("soft_start_enabled") and miner.get("power_entity"):
                                    reason = state.get("log_reason_on", "")
                                    _add_log_entry(hass, f"🎢 {miner_name}: Soft-Start (Hochfahren) gestartet. {reason}")
                                    _LOGGER.info(f"[{miner_name}] Starting Soft-Start Ramping Up {reason}")
                                    state["ramping"] = "up"
                                    state["ramping_step"] = 0
                                    state["ramping_last_time"] = 0 # trigger immediately
                                else:
                                    reason = state.get("log_reason_on", "")
                                    _add_log_entry(hass, f"⚡ {miner_name} wird eingeschaltet. {reason}")
                                    _LOGGER.info(f"[{miner_name}] Turn ON condition met, turning ON {switches} {reason}")
                                    await hass.services.async_call("switch", "turn_on", {"entity_id": switches}, blocking=False)
                                    
                                    # [NEU] Ziel-Wattzahl sofort setzen wenn kein Soft-Start
                                    target_p = miner.get("soft_target_power")
                                    p_ent = miner.get("power_entity")
                                    if target_p and p_ent:
                                        _LOGGER.info(f"[{miner_name}] Setze Ziel-Leistung auf {target_p}W")
                                        await hass.services.async_call("number", "set_value", {"entity_id": p_ent, "value": float(target_p)}, blocking=False)
                    else:
                        state["on_since"] = None

                    if turn_off_condition:
                        # [NEU] Hardware-Schutz: Mindestlaufzeit prüfen
                        min_run_mins = float(miner.get("min_run_time", 5))
                        on_for_secs = (current_time - state["on_since_actual"]) if state.get("on_since_actual") else 99999
                        
                        if is_on and on_for_secs < (min_run_mins * 60):
                            _LOGGER.debug(f"[{miner_name}] Abschaltung verzögert: Min-Run Schutz ({int(on_for_secs)}s < {int(min_run_mins*60)}s)")
                            turn_off_condition = False
                            state["off_since"] = None # Reset delay tracker
                        
                        if turn_off_condition:
                            if state["off_since"] is None:
                                state["off_since"] = current_time
                            elif current_time - state["off_since"] >= delay_seconds:
                                if is_on and state.get("ramping") != "down":
                                    if miner.get("soft_stop_enabled") and miner.get("power_entity"):
                                        reason = state.get("log_reason_off", "")
                                        _add_log_entry(hass, f"🎢 {miner_name}: Soft-Stop (Herunterfahren) gestartet. {reason}")
                                        _LOGGER.info(f"[{miner_name}] Starting Soft-Stop Ramping Down {reason}")
                                        state["ramping"] = "down"
                                        state["ramping_step"] = 0
                                        state["ramping_last_time"] = 0 # trigger immediately
                                    else:
                                        reason = state.get("log_reason_off", "")
                                        _add_log_entry(hass, f"💤 {miner_name} wird ausgeschaltet. {reason}")
                                        _LOGGER.info(f"[{miner_name}] Turn OFF condition met, turning OFF {switches} {reason}")
                                        
                                        # Hardware API Stop ausfuehren
                                    if coord and coord.miner_obj:
                                        try:
                                            _LOGGER.info(f"[{miner_name}] Direktes Ausschalten via API (Stop)")
                                            await coord.miner_obj.stop_mining()
                                        except Exception as e:
                                            _LOGGER.error(f"[{miner_name}] API Ausschalten fehlgeschlagen: {e}")
                                            
                                    await hass.services.async_call("switch", "turn_off", {"entity_id": switches}, blocking=False)
                    else:
                        state["off_since"] = None
                    
                    # Ramping Logic Execution
                    ramping = state.get("ramping")
                    if ramping:
                        # SAFETY CHECK: If the plug was turned off during ramping, abort ramping.
                        if not is_on and ramping == "up":
                            _LOGGER.warning(f"[{miner_name}] Soft-Start aborted: Smart Plug is OFF.")
                            state["ramping"] = None
                            ramping = None
                        
                        if ramping:
                            interval = float(miner.get("soft_interval", 60))
                        if current_time - state.get("ramping_last_time", 0) >= interval:
                            power_entity = miner.get("power_entity")
                            if ramping == "up" and power_entity:
                                steps = [s.strip() for s in str(miner.get("soft_start_steps", "100,500,1000")).split(",")]
                                target_power = float(miner.get("soft_target_power", 1200))
                                total_steps = len(steps)
                                if state["ramping_step"] < total_steps:
                                    state["ramping_total"] = total_steps
                                    val = min(float(steps[state["ramping_step"]]), target_power)
                                    _LOGGER.info(f"[{miner_name}] Soft-Start step {state['ramping_step'] + 1}/{total_steps}: {val}W")
                                    await hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": val}, blocking=False)
                                    
                                    # Immer Schalter prüfen beim ersten Schritt
                                    if state["ramping_step"] == 0:
                                        await hass.services.async_call("switch", "turn_on", {"entity_id": switches}, blocking=False)
                                    
                                    state["ramping_step"] += 1
                                    state["ramping_last_time"] = current_time
                                else:
                                    _add_log_entry(hass, f"✅ {miner_name}: Soft-Start abgeschlossen ({target_power}W).")
                                    await hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": target_power}, blocking=False)
                                    state["ramping"] = None
                            elif ramping == "down" and power_entity:
                                steps = [s.strip() for s in str(miner.get("soft_stop_steps", "1000,500,100")).split(",")]
                                target_power = float(miner.get("soft_target_power", 1200))
                                total_steps = len(steps)
                                if state["ramping_step"] < total_steps:
                                    state["ramping_total"] = total_steps
                                    val = float(steps[state["ramping_step"]])
                                    _LOGGER.info(f"[{miner_name}] Soft-Stop step {state['ramping_step'] + 1}/{total_steps}: {val}W")
                                    await hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": val}, blocking=False)
                                    state["ramping_step"] += 1
                                    state["ramping_last_time"] = current_time
                                else:
                                    _LOGGER.info(f"[{miner_name}] Soft-Stop complete. Turning OFF switches.")
                                    
                                    # Hardware API Stop ausfuehren am Ende des Soft-Stops
                                    if coord and coord.miner_obj:
                                        try:
                                            _LOGGER.info(f"[{miner_name}] Direktes Ausschalten via API (Stop)")
                                            await coord.miner_obj.stop_mining()
                                        except Exception as e:
                                            _LOGGER.error(f"[{miner_name}] API Ausschalten fehlgeschlagen: {e}")
                                            
                                    await hass.services.async_call("switch", "turn_off", {"entity_id": switches}, blocking=False)
                                    state["ramping"] = None
                
                # Manual mode might also need to stop ramping if state changed manually?
                # For now let's hope the user doesn't mess with it.
                elif mode == "manual":
                    state["on_since"] = None
                    state["off_since"] = None
                    state["ramping"] = None

                # Continuous Scaling Logic (Applies to PV, SOC and Manual if enabled)
                if miner.get("soft_continuous_scaling") and is_on and not state.get("ramping") and miner.get("power_entity"):
                    power_entity = miner.get("power_entity")
                    
                    # Prüfen ob das Intervall bereits vergangen ist
                    continuous_interval = float(miner.get("soft_interval", 60))
                    if current_time - state.get("continuous_last_time", 0) >= continuous_interval:
                        state["continuous_last_time"] = current_time
                        power_state = hass.states.get(power_entity)
                        
                        if power_state and power_state.state not in ["unknown", "unavailable"]:
                            try:
                                current_power = float(power_state.state)
                                target_power = float(miner.get("soft_target_power", 1200))

                                # In PV mode, calculate target based on current surplus steps
                                if mode == "pv":
                                    pv_sensor = miner.get("pv_sensor")
                                    if pv_sensor:
                                        pv_state = hass.states.get(pv_sensor)
                                        if pv_state and pv_state.state not in ["unknown", "unavailable"]:
                                            pv_val = float(pv_state.state)
                                            steps_str = str(miner.get("soft_start_steps", "100,500,1000"))
                                            steps = [float(s.strip()) for s in steps_str.split(",") if s.strip()]
                                            
                                            # Determine the highest possible step currently covered by PV
                                            best_step = target_power
                                            # If PV is less than target, find the highest fitting step
                                            if pv_val < target_power:
                                                allow_battery = miner.get("allow_battery", False)
                                                battery_min_soc = float(miner.get("battery_min_soc", 100))
                                                battery_soc = 0
                                                bat_sensor = miner.get("battery_sensor")
                                                if allow_battery and bat_sensor:
                                                    b_state = hass.states.get(bat_sensor)
                                                    if b_state and b_state.state not in ["unknown", "unavailable"]:
                                                        try:
                                                            battery_soc = float(b_state.state)
                                                        except ValueError:
                                                            pass
                                                
                                                # Falls Batterie-Unterstützung aktiv & genutzt werden kann, drossel nicht
                                                if allow_battery and battery_soc >= battery_min_soc:
                                                    best_step = target_power
                                                else:
                                                    # Normales PV-basiertes Herunterskalieren (Cloud-Tracking)
                                                    fitting_steps = [s for s in steps if s <= pv_val]
                                                    if fitting_steps:
                                                        best_step = max(fitting_steps)
                                                    else:
                                                        best_step = min(steps) if steps else target_power
                                            
                                            target_power = best_step

                                elif mode == "offgrid":
                                    # Linear scaling between SOC_Start and SOC_Max
                                    battery_sensor = miner.get("battery_sensor")
                                    if battery_sensor:
                                        bat_state = hass.states.get(battery_sensor)
                                        if bat_state and bat_state.state not in ["unknown", "unavailable"]:
                                            current_soc = float(bat_state.state)
                                            soc_start = float(miner.get("offgrid_soc_start", 90))
                                            soc_max = float(miner.get("offgrid_soc_max", 98))
                                            min_p = float(miner.get("offgrid_min_power", 400))
                                            max_p = float(miner.get("offgrid_max_power", 1400))
                                            
                                            if current_soc <= soc_start:
                                                target_power = min_p
                                            elif current_soc >= soc_max:
                                                target_power = max_p
                                            else:
                                                # Linear interpolation
                                                ratio = (current_soc - soc_start) / (soc_max - soc_start)
                                                target_power = min_p + (ratio * (max_p - min_p))
                                            
                                            # Round to nearest integer (or steps if needed, but 1W granularity is usually fine for API)
                                            target_power = round(target_power)

                                # Check if we need to adjust (with a 50W deadband to avoid jitter/spam)
                                deadband = 50.0
                                if abs(current_power - target_power) > deadband:
                                    _LOGGER.info(f"[{miner_name}] Continuous Scaling: Adjusting {current_power}W -> {target_power}W (Diff: {round(abs(current_power - target_power))}W > {deadband}W)")
                                    await hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": target_power}, blocking=False)

                            except (ValueError, TypeError):
                                pass


                
        except Exception as e:
            _LOGGER.error(f"Mining loop error: {e}")
        
        await asyncio.sleep(15)

async def _update_mempool_data(hass):
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            # 1. Empfohlene Gebühren
            async with session.get("https://mempool.space/api/v1/fees/recommended", timeout=10) as resp:
                if resp.status == 200:
                    fees = await resp.json()
                    hass.data[DOMAIN]["mempool_fees"] = fees
            
            # 2. Aktuelle Blockhöhe
            async with session.get("https://mempool.space/api/blocks/tip/height", timeout=10) as resp:
                if resp.status == 200:
                    height_text = await resp.text()
                    try:
                        h = int(height_text)
                        hass.data[DOMAIN]["mempool_height"] = h
                        
                        # Halving Berechnung (alle 210.000 Blöcke)
                        next_halving = ((h // 210000) + 1) * 210000
                        hass.data[DOMAIN]["mempool_halving"] = next_halving - h
                    except ValueError:
                        pass
            
            # 3. Bitcoin Kurs (EUR)
            async with session.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur", timeout=10) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    hass.data[DOMAIN]["btc_price"] = data.get("bitcoin", {}).get("eur", 0)
        
        hass.data[DOMAIN]["mempool_last_update"] = time.time()
    except Exception as e:
        _LOGGER.error(f"Fehler beim Abrufen der Mempool-Daten: {e}")

