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
    Platform.NUMBER,
    Platform.SELECT,
]

from homeassistant.components.frontend import async_register_built_in_panel, async_remove_panel

async def async_setup(hass: HomeAssistant, config: dict):
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    _LOGGER.info(f"Setting up OpenKairo Mining Integration: {entry.title}")
    
    hass.data.setdefault(DOMAIN, {})
    
    # Check if this entry contains IP address (meaning it's a hardware ASIC config)
    if "ip_address" in entry.data:
        # Load hardware platforms (sensor, switch, etc.) for this miner
        hass.data[DOMAIN].setdefault("miners", {})
        hass.data[DOMAIN]["miners"][entry.entry_id] = entry.data
        
        # We need to ensure the coordinators dict exists
        hass.data[DOMAIN].setdefault("coordinators", {})
        
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
                "module_url": f"/api/{DOMAIN}/frontend/openkairo-mining-panel.js?v=1.2.7"
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
                mode = miner.get("mode", "manual")
                miner_name = miner.get("name", "Unknown Miner")
                
                miner_switch = miner.get("switch")
                miner_switch_2 = miner.get("switch_2")
                miner_ip = miner.get("miner_ip")
                
                # Auto-Switch Fallback für Hardware-Treiber
                if not miner_switch and miner_ip:
                    miner_switch = f"switch.{DOMAIN}_{miner_ip.replace('.', '_')}_switch"
                    
                # Setup Hardware-Coordinator für diesen Miner, falls IP existiert
                if miner_ip:
                    name = miner.get("name", "Unknown Miner")
                    user = miner.get("miner_user")
                    password = miner.get("miner_password")
                    from .coordinator import async_get_miner_coordinator
                    # Coordinator erstellen / aktualisieren. Er holt automatisch Daten im Hintergrund.
                    await async_get_miner_coordinator(hass, DOMAIN, miner_ip, name, user, password)
                
                if not miner_switch:
                    continue
                    
                switches = [miner_switch]
                if miner_switch_2:
                    switches.append(miner_switch_2)
                    
                # Basis-Check: Sind alle konfigurierten Schalter an?
                is_on = all(hass.states.get(s).state == "on" if hass.states.get(s) else False for s in switches)

                # Erweiterter Check: Wenn der Miner Strom verbraucht (> 50W), behandeln wir ihn als EIN.
                # Dies verhindert Endlos-Loops beim Soft-Start, falls der Miner-Status (is_mining) noch nicht aktualisiert wurde.
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

                if "miner_states" not in hass.data[DOMAIN]:
                    hass.data[DOMAIN]["miner_states"] = {}
                miner_states = hass.data[DOMAIN]["miner_states"]
                
                miner_id = str(miner.get("id", miner_name))
                if miner_id not in miner_states:
                    miner_states[miner_id] = {"on_since": None, "off_since": None, "standby_since": None}
                
                state = miner_states[miner_id]
                current_time = time.time()

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
                            
                            # Standby-Switch (Hard Plug) automatically turn ON if it was hard-off
                            if miner.get("standby_watchdog_enabled"):
                                standby_switches = []
                                if miner.get("standby_switch"):
                                    standby_switches.append(miner.get("standby_switch"))
                                if miner.get("standby_switch_2"):
                                    standby_switches.append(miner.get("standby_switch_2"))

                                if standby_switches:
                                    # Wieder einschalten wenn nötig (mindestens einer AUS)
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
                                    _LOGGER.info(f"[{miner_name}] Turn ON condition met for >= {delay_minutes} min, turning ON {switches}")
                                    await hass.services.async_call("switch", "turn_on", {"entity_id": switches}, blocking=False)
                    else:
                        state["on_since"] = None

                    if turn_off_condition:
                        if state["off_since"] is None:
                            state["off_since"] = current_time
                        elif current_time - state["off_since"] >= delay_seconds:
                            if is_on and state.get("ramping") != "down":
                                if miner.get("soft_stop_enabled") and miner.get("power_entity"):
                                    _add_log_entry(hass, f"🎢 {miner_name}: Soft-Stop (Herunterfahren) gestartet.")
                                    _LOGGER.info(f"[{miner_name}] Starting Soft-Stop Ramping Down")
                                    state["ramping"] = "down"
                                    state["ramping_step"] = 0
                                    state["ramping_last_time"] = 0 # trigger immediately
                                else:
                                    _add_log_entry(hass, f"💤 {miner_name} wird ausgeschaltet (PV/SOC).")
                                    _LOGGER.info(f"[{miner_name}] Turn OFF condition met for >= {delay_minutes} min, turning OFF {switches}")
                                    await hass.services.async_call("switch", "turn_off", {"entity_id": switches}, blocking=False)
                    else:
                        state["off_since"] = None
                    
                    # Ramping Logic Execution
                    ramping = state.get("ramping")
                    if ramping:
                        interval = float(miner.get("soft_interval", 60))
                        if current_time - state.get("ramping_last_time", 0) >= interval:
                            power_entity = miner.get("power_entity")
                            if ramping == "up":
                                steps = [s.strip() for s in str(miner.get("soft_start_steps", "100,500,1000")).split(",")]
                                target_power = float(miner.get("soft_target_power", 1200))
                                total_steps = len(steps)
                                if state["ramping_step"] < total_steps:
                                    state["ramping_total"] = total_steps
                                    # Capping: Never exceed target_power during ramping steps
                                    val = min(float(steps[state["ramping_step"]]), target_power)
                                    _LOGGER.info(f"[{miner_name}] Soft-Start step {state['ramping_step'] + 1}/{total_steps}: Setting power to {val}W")
                                    await hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": val}, blocking=False)
                                    if state["ramping_step"] == 0 and not is_on:
                                        await hass.services.async_call("switch", "turn_on", {"entity_id": switches}, blocking=False)
                                    state["ramping_step"] += 1
                                    state["ramping_last_time"] = current_time
                                else:
                                    _add_log_entry(hass, f"✅ {miner_name}: Soft-Start abgeschlossen ({target_power}W).")
                                    _LOGGER.info(f"[{miner_name}] Soft-Start complete. Final power: {target_power}W")
                                    await hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": target_power}, blocking=False)
                                    state["ramping"] = None
                                    state["ramping_step"] = 0
                                    state["ramping_total"] = 0
                            elif ramping == "down":
                                steps = [s.strip() for s in str(miner.get("soft_stop_steps", "1000,500,100")).split(",")]
                                total_steps = len(steps)
                                if state["ramping_step"] < total_steps:
                                    state["ramping_total"] = total_steps
                                    val = float(steps[state["ramping_step"]])
                                    _LOGGER.info(f"[{miner_name}] Soft-Stop step {state['ramping_step'] + 1}/{total_steps}: Setting power to {val}W")
                                    await hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": val}, blocking=False)
                                    state["ramping_step"] += 1
                                    state["ramping_last_time"] = current_time
                                else:
                                    _LOGGER.info(f"[{miner_name}] Soft-Stop complete. Turning OFF {switches}")
                                    await hass.services.async_call("switch", "turn_off", {"entity_id": switches}, blocking=False)
                                    state["ramping"] = None
                                    state["ramping_step"] = 0
                                    state["ramping_total"] = 0
                
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

