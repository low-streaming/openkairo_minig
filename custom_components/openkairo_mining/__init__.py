import logging
import json
import os
import time
import asyncio
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components.http import HomeAssistantView
from homeassistant.const import EVENT_HOMEASSISTANT_START

DOMAIN = "openkairo_mining"
_LOGGER = logging.getLogger(__name__)

CONFIG_FILE = "openkairo_mining_config.json"

from homeassistant.components.frontend import async_register_built_in_panel, async_remove_panel

async def async_setup(hass: HomeAssistant, config: dict):
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    _LOGGER.info("Setting up OpenKairo Mining Integration")
    
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["config"] = await hass.async_add_executor_job(_load_config, hass)
    
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="OpenKairo Mining",
        sidebar_icon="mdi:lightning-bolt",
        frontend_url_path="openkairo_mining",
        config={
            "_panel_custom": {
                "name": "openkairo-mining-panel",
                "module_url": f"/api/{DOMAIN}/frontend/openkairo-mining-panel.js?v=1.2.0"
            }
        },
        require_admin=True
    )

    hass.http.register_view(OpenKairoMiningFrontendView())
    hass.http.register_view(OpenKairoMiningApiView())
    
    if not hass.data[DOMAIN].get("loop_started"):
        hass.data[DOMAIN]["loop_started"] = True
        if hass.is_running:
            hass.loop.create_task(_mining_loop(hass))
        else:
            hass.bus.async_listen_once(EVENT_HOMEASSISTANT_START, lambda event: hass.loop.create_task(_mining_loop(hass)))
    
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload a config entry."""
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
            
        from aiohttp import web
        return web.json_response({"status": "ok", "config": config, "states": clean_states})

    async def post(self, request):
        hass = request.app["hass"]
        data = await request.json()
        await hass.async_add_executor_job(_save_config, hass, data)
        from aiohttp import web
        return web.json_response({"status": "success"})


async def _mining_loop(hass):
    _LOGGER.info("Starting OpenKairo Mining background loop")
    while True:
        try:
            config = hass.data.get(DOMAIN, {}).get("config", {})
            miners = config.get("miners", [])
            
            # Nach Priorität sortieren (1 = höchste Priorität)
            sorted_miners = sorted(miners, key=lambda x: int(x.get("priority", 99)))
            
            for miner in sorted_miners:
                mode = miner.get("mode", "manual")
                miner_name = miner.get("name", "Unknown Miner")
                
                miner_switch = miner.get("switch")
                miner_switch_2 = miner.get("switch_2")
                
                if not miner_switch:
                    continue
                    
                switches = [miner_switch]
                if miner_switch_2:
                    switches.append(miner_switch_2)
                    
                is_on = all(hass.states.get(s).state == "on" if hass.states.get(s) else False for s in switches)

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
                    power_sensor = miner.get("power_consumption_sensor")
                    standby_switch = miner.get("standby_switch")
                    if power_sensor and standby_switch:
                        power_state = hass.states.get(power_sensor)
                        standby_switch_state = hass.states.get(standby_switch)
                        
                        if power_state and power_state.state not in ["unknown", "unavailable"] and standby_switch_state and standby_switch_state.state == "on":
                            try:
                                power_value = float(power_state.state)
                                standby_power = float(miner.get("standby_power", 100))
                                standby_delay_mins = float(miner.get("standby_delay", 10))
                                standby_delay_secs = standby_delay_mins * 60
                                
                                if power_value < standby_power:
                                    if state.get("standby_since") is None:
                                        state["standby_since"] = current_time
                                    elif current_time - state["standby_since"] >= standby_delay_secs:
                                        _LOGGER.warning(f"[{miner_name}] Watchdog triggered! Power {power_value}W < {standby_power}W for >={standby_delay_mins} min. Turning OFF {standby_switch}.")
                                        await hass.services.async_call("switch", "turn_off", {"entity_id": standby_switch}, blocking=False)
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
                                standby_switch = miner.get("standby_switch")
                                if standby_switch:
                                    standby_switch_state = hass.states.get(standby_switch)
                                    if standby_switch_state and standby_switch_state.state == "off":
                                        _LOGGER.info(f"[{miner_name}] Watchdog recovery! Turning ON {standby_switch}")
                                        await hass.services.async_call("switch", "turn_on", {"entity_id": standby_switch}, blocking=False)
                            
                            if not is_on and state.get("ramping") != "up":
                                if miner.get("soft_start_enabled") and miner.get("power_entity"):
                                    _LOGGER.info(f"[{miner_name}] Starting Soft-Start Ramping Up")
                                    state["ramping"] = "up"
                                    state["ramping_step"] = 0
                                    state["ramping_last_time"] = 0 # trigger immediately
                                else:
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
                                    _LOGGER.info(f"[{miner_name}] Starting Soft-Stop Ramping Down")
                                    state["ramping"] = "down"
                                    state["ramping_step"] = 0
                                    state["ramping_last_time"] = 0 # trigger immediately
                                else:
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
                                target_power = miner.get("soft_target_power", 1200)
                                if state["ramping_step"] < len(steps):
                                    val = steps[state["ramping_step"]]
                                    _LOGGER.info(f"[{miner_name}] Soft-Start step {state['ramping_step'] + 1}/{len(steps)}: Setting power to {val}W")
                                    await hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": val}, blocking=False)
                                    if state["ramping_step"] == 0 and not is_on:
                                        await hass.services.async_call("switch", "turn_on", {"entity_id": switches}, blocking=False)
                                    state["ramping_step"] += 1
                                    state["ramping_last_time"] = current_time
                                else:
                                    _LOGGER.info(f"[{miner_name}] Soft-Start complete. Final power: {target_power}W")
                                    await hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": target_power}, blocking=False)
                                    state["ramping"] = None
                            elif ramping == "down":
                                steps = [s.strip() for s in str(miner.get("soft_stop_steps", "1000,500,100")).split(",")]
                                if state["ramping_step"] < len(steps):
                                    val = steps[state["ramping_step"]]
                                    _LOGGER.info(f"[{miner_name}] Soft-Stop step {state['ramping_step'] + 1}/{len(steps)}: Setting power to {val}W")
                                    await hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": val}, blocking=False)
                                    state["ramping_step"] += 1
                                    state["ramping_last_time"] = current_time
                                else:
                                    _LOGGER.info(f"[{miner_name}] Soft-Stop complete. Turning OFF {switches}")
                                    await hass.services.async_call("switch", "turn_off", {"entity_id": switches}, blocking=False)
                                    state["ramping"] = None
                
                # Manual mode might also need to stop ramping if state changed manually?
                # For now let's hope the user doesn't mess with it.
                elif mode == "manual":
                    state["on_since"] = None
                    state["off_since"] = None
                    state["ramping"] = None
                
        except Exception as e:
            _LOGGER.error(f"Mining loop error: {e}")
        
        await asyncio.sleep(30)
