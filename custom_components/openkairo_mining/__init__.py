import logging
import json
import os
import asyncio
from typing import Any
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
                "module_url": f"/api/{DOMAIN}/frontend/openkairo-mining-panel.js?v=2.0.0"
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
            
    async def handle_miner_command(call):
        miner_id = call.data.get("miner_id")
        command = call.data.get("command")
        
        config = hass.data.get(DOMAIN, {}).get("config", {})
        for m in config.get("miners", []):
            if m.get("id") == miner_id:
                if m.get("miner_ip"):
                    await async_cgminer_api(m.get("miner_ip"), 4028, command)
                return
    
    hass.services.async_register(DOMAIN, "send_miner_command", handle_miner_command)
    
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


async def async_cgminer_api(host: str, port: int, command: str) -> Any:
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=3.0)
        request = json.dumps({"command": command})
        writer.write(request.encode('utf-8'))
        await writer.drain()
        
        data = await asyncio.wait_for(reader.read(4096), timeout=3.0)
        writer.close()
        await writer.wait_closed()
        
        cleaned_data = data.decode('utf-8').replace('\x00', '')
        
        # Manchmal hängt noch etwas nach dem JSON dran, wir suchen das letzte }
        end_idx = cleaned_data.rfind('}')
        if end_idx != -1:
            cleaned_data = cleaned_data[:end_idx+1]
            try:
                return json.loads(cleaned_data)
            except Exception:
                pass
    except Exception as e:
        _LOGGER.debug(f"CGMiner API Error ({host}): {e}")
    return None


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
                
                # Fetch Miner Stats if IP is provided
                miner_ip = miner.get("miner_ip")
                if miner_ip and is_on:
                    summary = await async_cgminer_api(miner_ip, 4028, "summary")
                    if summary and "SUMMARY" in summary and len(summary["SUMMARY"]) > 0:
                        hashrate_ghs = summary["SUMMARY"][0].get("GHS 5s", summary["SUMMARY"][0].get("GHS av", 0))
                        hashrate_ths = hashrate_ghs / 1000.0
                        hass.states.async_set(f"sensor.openkairo_{miner.get('id')}_hashrate", round(hashrate_ths, 2), {"unit_of_measurement": "TH/s", "friendly_name": f"{miner_name} Hashrate", "icon": "mdi:speedometer"})
                    else:
                        hass.states.async_set(f"sensor.openkairo_{miner.get('id')}_hashrate", 0, {"unit_of_measurement": "TH/s", "friendly_name": f"{miner_name} Hashrate", "icon": "mdi:speedometer"})
                        
                    stats = await async_cgminer_api(miner_ip, 4028, "stats")
                    if stats and "STATS" in stats and len(stats["STATS"]) > 0:
                        temp = None
                        for stat in stats["STATS"]:
                            if stat.get("temp2"): temp = stat["temp2"]
                            elif stat.get("Temp"): temp = stat["Temp"]
                            elif stat.get("Temperature"): temp = stat["Temperature"]
                            if temp is not None: break
                        if temp is not None:
                            hass.states.async_set(f"sensor.openkairo_{miner.get('id')}_temperature", temp, {"unit_of_measurement": "°C", "friendly_name": f"{miner_name} Temperatur", "icon": "mdi:thermometer"})

                elif not is_on:
                     hass.states.async_set(f"sensor.openkairo_{miner.get('id')}_hashrate", 0, {"unit_of_measurement": "TH/s", "friendly_name": f"{miner_name} Hashrate", "icon": "mdi:speedometer"})
                     hass.states.async_set(f"sensor.openkairo_{miner.get('id')}_temperature", 0, {"unit_of_measurement": "°C", "friendly_name": f"{miner_name} Temperatur", "icon": "mdi:thermometer"})


                if mode == "pv":
                    pv_sensor = miner.get("pv_sensor")
                    if pv_sensor:
                        pv_state = hass.states.get(pv_sensor)
                        if pv_state and pv_state.state not in ["unknown", "unavailable"]:
                            try:
                                pv_value = float(pv_state.state)
                                on_threshold = float(miner.get("pv_on", 1000))
                                off_threshold = float(miner.get("pv_off", 500))
                                
                                if pv_value >= on_threshold and not is_on:
                                    _LOGGER.info(f"[{miner_name}] PV excess ({pv_value}W) >= {on_threshold}W, turning ON {miner_switch}")
                                    await hass.services.async_call("switch", "turn_on", {"entity_id": miner_switch}, blocking=False)
                                    
                                elif pv_value <= off_threshold and is_on:
                                    _LOGGER.info(f"[{miner_name}] PV excess ({pv_value}W) <= {off_threshold}W, turning OFF {miner_switch}")
                                    await hass.services.async_call("switch", "turn_off", {"entity_id": miner_switch}, blocking=False)
                            except ValueError:
                                pass
                
                elif mode == "price":
                    price_sensor = miner.get("price_sensor")
                    if price_sensor:
                        price_state = hass.states.get(price_sensor)
                        if price_state and price_state.state not in ["unknown", "unavailable"]:
                            try:
                                price_value = float(price_state.state)
                                on_threshold = float(miner.get("price_on", 20))
                                off_threshold = float(miner.get("price_off", 25))
                                
                                if price_value <= on_threshold and not is_on:
                                    _LOGGER.info(f"[{miner_name}] Price ({price_value} c/kWh) <= {on_threshold}, turning ON {miner_switch}")
                                    await hass.services.async_call("switch", "turn_on", {"entity_id": miner_switch}, blocking=False)
                                    
                                elif price_value >= off_threshold and is_on:
                                    _LOGGER.info(f"[{miner_name}] Price ({price_value} c/kWh) >= {off_threshold}, turning OFF {miner_switch}")
                                    await hass.services.async_call("switch", "turn_off", {"entity_id": miner_switch}, blocking=False)
                            except ValueError:
                                pass
                
        except Exception as e:
            _LOGGER.error(f"Mining loop error: {e}")
        
        await asyncio.sleep(30)
