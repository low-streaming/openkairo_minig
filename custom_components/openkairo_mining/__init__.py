import logging
import json
import os
import time
import asyncio
import pydantic

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
                "temp_sensor":             f"sensor.{domain}_{safe_ip}_durchschnittliche_temperatur",
                "power_consumption_sensor": f"sensor.{domain}_{safe_ip}_verbrauch",
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
                # Update existing entry: fill in any missing entity references
                miner = config["miners"][existing_idx]
                changed = False
                for key, val in auto_entities.items():
                    if not miner.get(key):
                        miner[key] = val
                        changed = True
                if changed:
                    config["miners"][existing_idx] = miner
                    await hass.async_add_executor_job(_save_config, hass, config)
                    _LOGGER.info(f"Updated miner {entry.title} ({ip}) with missing entity references")

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
                "module_url": f"/api/{DOMAIN}/frontend/openkairo-mining-panel.js?v=1.3.5"
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
        
        # Sterilize states (remove large objects if any)
        clean_states = {}
        for mid, s in states.items():
            clean_states[mid] = {k: v for k, v in s.items() if k != "active_ramping_task"}
            
        mempool = {
            "fees": hass.data.get(DOMAIN, {}).get("mempool_fees"),
            "height": hass.data.get(DOMAIN, {}).get("mempool_height"),
            "halving": hass.data.get(DOMAIN, {}).get("mempool_halving")
        }
        
        logs = hass.data.get(DOMAIN, {}).get("logs", [])

        from aiohttp import web
        return web.json_response({"status": "ok", "config": config, "states": clean_states, "mempool": mempool, "logs": logs})

 
    async def post(self, request):
        hass = request.app["hass"]
        data = await request.json()
        await hass.async_add_executor_job(_save_config, hass, data)
        from aiohttp import web
        return web.json_response({"status": "success"})

def _add_log_entry(hass, message):
    if DOMAIN not in hass.data:
        return
    if "logs" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["logs"] = []
    
    timestamp = time.strftime("%H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    
    hass.data[DOMAIN]["logs"].insert(0, log_entry)
    # Keep only last 20 entries
    hass.data[DOMAIN]["logs"] = hass.data[DOMAIN]["logs"][:20]
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
            for miner in sorted_miners:
                miner_id = str(miner.get("id", miner.get("name", "Unknown")))
                if "miner_states" not in hass.data[DOMAIN]:
                    hass.data[DOMAIN]["miner_states"] = {}
                miner_states = hass.data[DOMAIN]["miner_states"]
                if miner_id not in miner_states:
                    miner_states[miner_id] = {"on_since": None, "off_since": None, "standby_since": None}
                
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
                # Basis-Check: Sind alle konfigurierten Schalter an?
                is_on = all(hass.states.get(s).state == "on" if hass.states.get(s) else False for s in switches)

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
                            state["hashrate"] = getattr(coord.data, "hashrate", 0) or 0
                            state["power"] = getattr(coord.data, "wattage", 0) or getattr(coord.data, "power", 0) or 0
                            state["temp"] = getattr(coord.data, "temperature_avg", 0) or getattr(coord.data, "temperature", 0) or 0
                            state["is_mining"] = getattr(coord.data, "is_mining", False)
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
                                
                                if current_value < standby_threshold:
                                    if state.get("standby_since") is None:
                                        state["standby_since"] = current_time
                                        _LOGGER.info(f"[{miner_name}] Watchdog Countdown gestartet: Wert {current_value} < {standby_threshold}")
                                    elif current_time - state["standby_since"] >= standby_delay_secs:
                                        msg = f"Watchdog an {miner_name} ausgelöst ({watchdog_type})! Wert {current_value} zu niedrig. Schalte Steckdose AUS."
                                        _LOGGER.warning(f"[{miner_name}] {msg}")
                                        _add_log_entry(hass, f"🛡️ {msg}")
                                        await hass.services.async_call("switch", "turn_off", {"entity_id": standby_switches}, blocking=False)
                                        state["standby_since"] = None
                                else:
                                    state["standby_since"] = None
                            except ValueError:
                                pass

                if mode in ["pv", "soc"]:
                    delay_minutes = float(miner.get("delay_minutes", 0))
                    delay_seconds = delay_minutes * 60
                    
                    turn_on_condition = False
                    turn_off_condition = False

                    if mode == "pv":
                        pv_sensor = miner.get("pv_sensor")
                        if pv_sensor:
                            pv_state = hass.states.get(pv_sensor)
                            if pv_state and pv_state.state not in ["unknown", "unavailable"]:
                                try:
                                    pv_value = float(pv_state.state)
                                    on_threshold = float(miner.get("pv_on", 1000))
                                    off_threshold = float(miner.get("pv_off", 500))
                                    
                                    battery_sensor = miner.get("battery_sensor")
                                    battery_min_soc = float(miner.get("battery_min_soc", 100))
                                    allow_battery = miner.get("allow_battery", False)
                                    
                                    battery_soc = 0
                                    if allow_battery and battery_sensor:
                                        bat_state = hass.states.get(battery_sensor)
                                        if bat_state and bat_state.state not in ["unknown", "unavailable"]:
                                            battery_soc = float(bat_state.state)
                                    
                                    if pv_value >= on_threshold:
                                        turn_on_condition = True
                                    elif allow_battery and battery_soc >= battery_min_soc:
                                        turn_on_condition = True
                                    
                                    # Wetter-Vorhersage Check (Optional)
                                    forecast_sensor = miner.get("forecast_sensor")
                                    forecast_min = float(miner.get("forecast_min", 0))
                                    if forecast_sensor and turn_on_condition:
                                        f_state = hass.states.get(forecast_sensor)
                                        if f_state and f_state.state not in ["unknown", "unavailable"]:
                                            try:
                                                if float(f_state.state) < forecast_min:
                                                    turn_on_condition = False # Prognose zu schlecht
                                            except ValueError:
                                                pass

                                    if pv_value <= off_threshold:
                                        if not allow_battery or (allow_battery and battery_soc < battery_min_soc):
                                            turn_off_condition = True
                                            
                                except ValueError:
                                    pass
                    elif mode == "soc":
                        battery_sensor = miner.get("battery_sensor")
                        if battery_sensor:
                            bat_state = hass.states.get(battery_sensor)
                            if bat_state and bat_state.state not in ["unknown", "unavailable"]:
                                try:
                                    battery_soc = float(bat_state.state)
                                    soc_on = float(miner.get("soc_on", 90))
                                    soc_off = float(miner.get("soc_off", 30))
                                    
                                    if battery_soc >= soc_on:
                                        turn_on_condition = True
                                    elif battery_soc <= soc_off:
                                        turn_off_condition = True
                                except ValueError:
                                    pass
                    


                    # Apply Hysterese and Ramping
                    if turn_on_condition:
                        if state["on_since"] is None:
                            state["on_since"] = current_time
                        elif current_time - state["on_since"] >= delay_seconds:
                            
                            # [NEU] Direktes Einschalten via Hardware-Treiber (Bypass HA Switches)
                            if coord and coord.miner_obj:
                                try:
                                    _LOGGER.info(f"[{miner_name}] Direktes Einschalten via API (Resume)")
                                    await coord.miner_obj.resume_mining()
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
                                    _add_log_entry(hass, f"🎢 {miner_name}: Soft-Start (Hochfahren) gestartet.")
                                    _LOGGER.info(f"[{miner_name}] Starting Soft-Start Ramping Up")
                                    state["ramping"] = "up"
                                    state["ramping_step"] = 0
                                    state["ramping_last_time"] = 0 # trigger immediately
                                else:
                                    _add_log_entry(hass, f"⚡ {miner_name} wird eingeschaltet (PV/SOC).")
                                    _LOGGER.info(f"[{miner_name}] Turn ON condition met, turning ON {switches}")
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
                        if state["off_since"] is None:
                            state["off_since"] = current_time
                        elif current_time - state["off_since"] >= delay_seconds:
                            
                            # [NEU] Direktes Ausschalten via Hardware-Treiber (Bypass HA Switches)
                            if coord and coord.miner_obj:
                                try:
                                    _LOGGER.info(f"[{miner_name}] Direktes Ausschalten via API (Stop)")
                                    await coord.miner_obj.stop_mining()
                                except Exception as e:
                                    _LOGGER.error(f"[{miner_name}] API Ausschalten fehlgeschlagen: {e}")

                            if is_on and state.get("ramping") != "down":
                                if miner.get("soft_stop_enabled") and miner.get("power_entity"):
                                    _add_log_entry(hass, f"🎢 {miner_name}: Soft-Stop (Herunterfahren) gestartet.")
                                    _LOGGER.info(f"[{miner_name}] Starting Soft-Stop Ramping Down")
                                    state["ramping"] = "down"
                                    state["ramping_step"] = 0
                                    state["ramping_last_time"] = 0 # trigger immediately
                                else:
                                    _add_log_entry(hass, f"💤 {miner_name} wird ausgeschaltet (PV/SOC).")
                                    _LOGGER.info(f"[{miner_name}] Turn OFF condition met, turning OFF {switches}")
                                    await hass.services.async_call("switch", "turn_off", {"entity_id": switches}, blocking=False)
                    else:
                        state["off_since"] = None
                    
                    # Ramping Logic Execution
                    ramping = state.get("ramping")
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
                                                # Sort steps descending to find the first one that fits
                                                fitting_steps = [s for s in steps if s <= pv_val]
                                                if fitting_steps:
                                                    best_step = max(fitting_steps)
                                                else:
                                                    best_step = min(steps) if steps else target_power
                                            
                                            target_power = best_step

                                # Check if we need to adjust (with a small 5W tolerance to avoid jitter)
                                if abs(current_power - target_power) > 5:
                                    _LOGGER.info(f"[{miner_name}] Continuous Scaling: Adjusting {current_power}W -> {target_power}W (Interval: {continuous_interval}s)")
                                    await hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": target_power}, blocking=False)

                            except (ValueError, TypeError):
                                pass


                
        except Exception as e:
            _LOGGER.error(f"Mining loop error: {e}")
        
        await asyncio.sleep(30)

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
        
        hass.data[DOMAIN]["mempool_last_update"] = time.time()
    except Exception as e:
        _LOGGER.error(f"Fehler beim Abrufen der Mempool-Daten: {e}")

