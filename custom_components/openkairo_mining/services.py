import logging
import voluptuous as vol
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

SERVICE_REBOOT = "reboot"
SERVICE_RESTART = "restart_backend"
SERVICE_SET_WORK_MODE = "set_work_mode"
SERVICE_SET_POWER_LIMIT = "set_power_limit"

# Base schema for simple IP-only calls
SERVICE_BASE_SCHEMA = vol.Schema({
    vol.Required("ip_address"): cv.string,
})

# Schema for power limit
import asyncio

async def async_send_raw_command(ip, command):
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(ip, 4028), timeout=5)
        writer.write(f'{{"command":"{command}"}}'.encode())
        await writer.drain()
        resp = await reader.read(1024)
        writer.close()
        await writer.wait_closed()
        return resp
    except Exception as e:
        _LOGGER.error(f"Raw socket command {command} to {ip} failed: {e}")
        return None

SERVICE_POWER_LIMIT_SCHEMA = vol.Schema({
    vol.Required("ip_address"): cv.string,
    vol.Required("limit"): vol.Coerce(int),
})

# Schema for work mode
SERVICE_WORK_MODE_SCHEMA = vol.Schema({
    vol.Required("ip_address"): cv.string,
    vol.Required("mode"): cv.string, # low, normal, high
})

async def async_setup_services(hass):
    """Register services for the Miner integration."""
    
    async def get_coord(call):
        ip_address = call.data.get("ip_address")
        return hass.data[DOMAIN].get("coordinators", {}).get(ip_address)

    async def handle_reboot(call):
        coord = await get_coord(call)
        if coord and coord.miner_obj:
            try:
                _LOGGER.info(f"[{coord.miner_ip}] Rebooting miner...")
                await coord.miner_obj.reboot()
            except Exception as e:
                _LOGGER.error(f"Reboot failed: {e}")

    async def handle_restart(call):
        coord = await get_coord(call)
        if coord and coord.miner_obj:
            try:
                _LOGGER.info(f"[{coord.miner_ip}] Restarting miner backend...")
                # pyasic handles different restart types depending on backend
                await coord.miner_obj.restart_backend()
            except Exception as e:
                _LOGGER.error(f"Restart failed: {e}")

    async def handle_set_work_mode(call):
        import time
        coord = await get_coord(call)
        mode = call.data.get("mode", "normal").lower()
        if coord and coord.miner_obj:
            try:
                miner = coord.miner_obj
                _LOGGER.info(f"[{coord.miner_ip}] Setting work mode to {mode}")
                
                # Avalon specific handling (Nano 3 / Q)
                if "Avalon" in str(type(miner)) or "Avalon" in coord.miner_make:
                    now = int(time.time()) + 5
                    
                    if mode == "standby":
                        _LOGGER.info(f"[{coord.miner_ip}] Sending Avalon to standby (softoff)")
                        await miner.api.send_command("ascset", parameter=f"0,softoff,1:{now}")
                    else:
                        # If we want to set a mode, check if we need to wake up first
                        # We can check is_mining or hashrate
                        is_mining = coord.data.get("is_mining", True) if coord.data else True
                        if not is_mining or mode == "restart":
                            _LOGGER.info(f"[{coord.miner_ip}] Waking Avalon from standby (softon)")
                            await miner.api.send_command("ascset", parameter=f"0,softon,1:{now}")
                            await asyncio.sleep(2) # Short wait before setting mode
                        
                        if mode != "restart":
                            mode_map = {"low": "0", "normal": "1", "high": "2"}
                            mode_val = mode_map.get(mode, "1")
                            await miner.api.send_command("ascset", parameter=f"0,workmode,set,{mode_val}")
                else:
                    # Non-Avalon miners (e.g. VNish, BOS+)
                    if mode == "standby":
                        try:
                            _LOGGER.info(f"[{coord.miner_ip}] Stopping mining natively...")
                            await miner.stop_mining()
                        except Exception as e_stop:
                            _LOGGER.warning(f"Native stop failed: {e_stop}. Trying absolute Raw Socket pause...")
                            await async_send_raw_command(coord.miner_ip, "pause")
                    else:
                        if not coord.data.get("is_mining", True):
                            try:
                                _LOGGER.info(f"[{coord.miner_ip}] Resuming mining natively...")
                                await miner.resume_mining()
                            except Exception as e_res:
                                _LOGGER.warning(f"Native resume failed: {e_res}. Trying absolute Raw Socket resume...")
                                await async_send_raw_command(coord.miner_ip, "resume")
                        
                        try:
                            if hasattr(miner, "set_work_mode"):
                                await miner.set_work_mode(mode)
                        except Exception as e_mode:
                            _LOGGER.error(f"Set work mode via api failed: {e_mode}")
                
                await coord.async_request_refresh()
            except Exception as e:
                _LOGGER.error(f"Set work mode failed completely: {e}")

    async def handle_set_power_limit(call):
        coord = await get_coord(call)
        limit = call.data.get("limit")
        if coord and coord.miner_obj and limit:
            try:
                _LOGGER.info(f"[{coord.miner_ip}] Setting power limit to {limit}W")
                await coord.miner_obj.set_power_limit(int(limit))
                await coord.async_request_refresh()
            except Exception as e:
                _LOGGER.error(f"Set Power Limit failed: {e}")

    async def handle_set_integration_mode(call):
        ip = call.data.get("ip_address")
        new_mode = call.data.get("mode")
        config = hass.data.get(DOMAIN, {}).get("config", {"miners": []})
        updated = False
        for m in config.get("miners", []):
            if m.get("miner_ip") == ip or m.get("id") == ip:
                m["mode"] = new_mode
                updated = True
                break
        if updated:
            from .__init__ import _save_config
            await hass.async_add_executor_job(_save_config, hass, config)
            _LOGGER.info(f"Updated integration mode for {ip} to {new_mode}")

    hass.services.async_register(DOMAIN, SERVICE_REBOOT, handle_reboot, schema=SERVICE_BASE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_RESTART, handle_restart, schema=SERVICE_BASE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_SET_WORK_MODE, handle_set_work_mode, schema=SERVICE_WORK_MODE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_SET_POWER_LIMIT, handle_set_power_limit, schema=SERVICE_POWER_LIMIT_SCHEMA)
    
    # [NEW] Service for Automations to switch between PV / AI / SOC etc.
    hass.services.async_register(
        DOMAIN, 
        "set_integration_mode", 
        handle_set_integration_mode, 
        schema=vol.Schema({
            vol.Required("ip_address"): cv.string,
            vol.Required("mode"): cv.string,
        })
    )
