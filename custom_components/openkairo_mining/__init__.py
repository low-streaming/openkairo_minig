import logging
import json
import os
import asyncio
from homeassistant.core import HomeAssistant
from homeassistant.components.http import HomeAssistantView
from homeassistant.const import EVENT_HOMEASSISTANT_START

DOMAIN = "openkairo_mining"
_LOGGER = logging.getLogger(__name__)

CONFIG_FILE = "openkairo_mining_config.json"

async def async_setup(hass: HomeAssistant, config: dict):
    _LOGGER.info("Setting up OpenKairo Mining Integration")
    
    hass.data.setdefault(DOMAIN, {
        "config": _load_config(hass),
    })
    
    hass.components.frontend.async_register_built_in_panel(
        component_name="custom",
        sidebar_title="OpenKairo Mining",
        sidebar_icon="mdi:pickaxe",
        frontend_url_path="openkairo_mining",
        config={
            "_panel_custom": {
                "name": "openkairo-mining-panel",
                "module_url": f"/api/{DOMAIN}/frontend/openkairo-mining-panel.js?v=1.0.0"
            }
        },
        require_admin=True
    )

    hass.http.register_view(OpenKairoMiningFrontendView())
    hass.http.register_view(OpenKairoMiningApiView())
    
    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_START, lambda event: start_mining_loop(hass))
    
    return True

def _get_config_path(hass):
    return hass.config.path(CONFIG_FILE)

def _load_config(hass):
    path = _get_config_path(hass)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except Exception as e:
                _LOGGER.error(f"Error loading OpenKairo Mining config: {e}")
    return {}

def _save_config(hass, data):
    path = _get_config_path(hass)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)
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
    requires_auth = True

    async def get(self, request):
        hass = request.app["hass"]
        config = hass.data[DOMAIN].get("config", {})
        from aiohttp import web
        return web.json_response({"status": "ok", "config": config})

    async def post(self, request):
        hass = request.app["hass"]
        data = await request.json()
        _save_config(hass, data)
        from aiohttp import web
        return web.json_response({"status": "success"})


def start_mining_loop(hass):
    hass.loop.create_task(_mining_loop(hass))

async def _mining_loop(hass):
    _LOGGER.info("Starting OpenKairo Mining background loop")
    while True:
        try:
            config = hass.data[DOMAIN].get("config", {})
            
            pv_sensor = config.get("pv_sensor")
            miner_switch = config.get("miner_switch")
            mode = config.get("mode", "manual")
            
            if mode == "pv" and pv_sensor and miner_switch:
                pv_state = hass.states.get(pv_sensor)
                if pv_state and pv_state.state not in ["unknown", "unavailable"]:
                    try:
                        pv_value = float(pv_state.state)
                        on_threshold = float(config.get("pv_on_threshold", 1000))
                        off_threshold = float(config.get("pv_off_threshold", 500))
                        
                        switch_state = hass.states.get(miner_switch)
                        is_on = switch_state.state == "on" if switch_state else False
                        
                        if pv_value >= on_threshold and not is_on:
                            _LOGGER.info(f"PV excess ({pv_value}W) >= {on_threshold}W, turning ON {miner_switch}")
                            await hass.services.async_call("switch", "turn_on", {"entity_id": miner_switch}, blocking=False)
                            
                        elif pv_value <= off_threshold and is_on:
                            _LOGGER.info(f"PV excess ({pv_value}W) <= {off_threshold}W, turning OFF {miner_switch}")
                            await hass.services.async_call("switch", "turn_off", {"entity_id": miner_switch}, blocking=False)
                    except ValueError:
                        pass
                        
            elif mode == "price":
                price_sensor = config.get("price_sensor")
                if price_sensor and miner_switch:
                    price_state = hass.states.get(price_sensor)
                    if price_state and price_state.state not in ["unknown", "unavailable"]:
                        try:
                            price_value = float(price_state.state)
                            on_threshold = float(config.get("price_on_threshold", 20))
                            off_threshold = float(config.get("price_off_threshold", 25))
                            
                            switch_state = hass.states.get(miner_switch)
                            is_on = switch_state.state == "on" if switch_state else False
                            
                            if price_value <= on_threshold and not is_on:
                                _LOGGER.info(f"Price ({price_value} c/kWh) <= {on_threshold}, turning ON {miner_switch}")
                                await hass.services.async_call("switch", "turn_on", {"entity_id": miner_switch}, blocking=False)
                                
                            elif price_value >= off_threshold and is_on:
                                _LOGGER.info(f"Price ({price_value} c/kWh) >= {off_threshold}, turning OFF {miner_switch}")
                                await hass.services.async_call("switch", "turn_off", {"entity_id": miner_switch}, blocking=False)
                        except ValueError:
                            pass
                
        except Exception as e:
            _LOGGER.error(f"Mining loop error: {e}")
        
        await asyncio.sleep(30)
