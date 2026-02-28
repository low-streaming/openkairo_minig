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
    hass.data[DOMAIN]["config"] = _load_config(hass)
    
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="OpenKairo Mining",
        sidebar_icon="mdi:lightning-bolt",
        frontend_url_path="openkairo_mining",
        config={
            "_panel_custom": {
                "name": "openkairo-mining-panel",
                "module_url": f"/api/{DOMAIN}/frontend/openkairo-mining-panel.js?v=2.1.0"
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
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
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
        from aiohttp import web
        return web.json_response({"status": "ok", "config": config})

    async def post(self, request):
        hass = request.app["hass"]
        data = await request.json()
        _save_config(hass, data)
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
                miner_switch = miner.get("switch")
                miner_name = miner.get("name", "Unknown Miner")
                
                if not miner_switch:
                    continue
                    
                switch_state = hass.states.get(miner_switch)
                is_on = switch_state.state == "on" if switch_state else False

                if mode in ["pv", "soc"]:
                    delay_minutes = float(miner.get("delay_minutes", 0))
                    delay_seconds = delay_minutes * 60
                    
                    if "miner_states" not in hass.data[DOMAIN]:
                        hass.data[DOMAIN]["miner_states"] = {}
                    miner_states = hass.data[DOMAIN]["miner_states"]
                    
                    miner_id = str(miner.get("id", miner_name))
                    if miner_id not in miner_states:
                        miner_states[miner_id] = {"on_since": None, "off_since": None}
                    
                    state = miner_states[miner_id]
                    current_time = time.time()
                    
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
                    


                    # Apply Hysterese
                    if turn_on_condition:
                        if state["on_since"] is None:
                            state["on_since"] = current_time
                        elif current_time - state["on_since"] >= delay_seconds:
                            if not is_on:
                                _LOGGER.info(f"[{miner_name}] Turn ON condition met for >= {delay_minutes} min, turning ON {miner_switch}")
                                await hass.services.async_call("switch", "turn_on", {"entity_id": miner_switch}, blocking=False)
                    else:
                        state["on_since"] = None

                    if turn_off_condition:
                        if state["off_since"] is None:
                            state["off_since"] = current_time
                        elif current_time - state["off_since"] >= delay_seconds:
                            if is_on:
                                _LOGGER.info(f"[{miner_name}] Turn OFF condition met for >= {delay_minutes} min, turning OFF {miner_switch}")
                                await hass.services.async_call("switch", "turn_off", {"entity_id": miner_switch}, blocking=False)
                    else:
                        state["off_since"] = None
                
        except Exception as e:
            _LOGGER.error(f"Mining loop error: {e}")
        
        await asyncio.sleep(30)
