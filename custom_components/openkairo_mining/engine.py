import logging
import json
import os
import time
import asyncio
import aiohttp
from datetime import datetime, timedelta
import homeassistant.util.dt as dt_util
from homeassistant.core import HomeAssistant
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

class MiningEngine:
    """The central engine that manages the mining logic loop."""

    def __init__(self, hass: HomeAssistant):
        self.hass = hass
        self.loop_started = False
        self._mempool_fees = {}
        self._mempool_height = 0
        self._mempool_halving = 0
        self._btc_price = 0
        self._logs = []
        self._miner_states = {}

    @property
    def miner_states(self):
        return self._miner_states

    @property
    def logs(self):
        return self._logs

    @property
    def btc_price(self):
        return self._btc_price

    @property
    def mempool_data(self):
        return {
            "fees": self._mempool_fees,
            "height": self._mempool_height,
            "halving": self._mempool_halving
        }

    def add_log_entry(self, message):
        timestamp = time.strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        self._logs.insert(0, log_entry)
        self._logs = self._logs[:100]
        _LOGGER.info(f"[OpenKairo Log] {message}")

    async def update_mempool_data(self):
        try:
            async with aiohttp.ClientSession() as session:
                # 1. Recommended Fees
                async with session.get("https://mempool.space/api/v1/fees/recommended", timeout=10) as resp:
                    if resp.status == 200:
                        self._mempool_fees = await resp.json()
                
                # 2. Block Height
                async with session.get("https://mempool.space/api/blocks/tip/height", timeout=10) as resp:
                    if resp.status == 200:
                        height_text = await resp.text()
                        try:
                            h = int(height_text)
                            self._mempool_height = h
                            self._mempool_halving = (((h // 210000) + 1) * 210000) - h
                        except ValueError:
                            pass
                
                # 3. BTC Price
                async with session.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur", timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        self._btc_price = data.get("bitcoin", {}).get("eur", 0)
            
            self.hass.data[DOMAIN]["mempool_last_update"] = time.time()
        except Exception as e:
            _LOGGER.error(f"Error fetching mempool data: {e}")

    async def get_avg_night_load(self, entity_id, days=3):
        """Calculates the average night load (22:00 - 06:00) of a sensor."""
        try:
            from homeassistant.components.recorder import history
            
            end_time = dt_util.utcnow()
            start_time = end_time - timedelta(days=days)
            
            all_states = await self.hass.async_add_executor_job(
                history.state_changes_during_period,
                self.hass,
                start_time,
                end_time,
                entity_id
            )
            
            states = all_states.get(entity_id, [])
            if not states:
                return 0
                
            valid_values = []
            for s in states:
                if s.state in ["unknown", "unavailable", None]:
                    continue
                
                local_dt = dt_util.as_local(s.last_changed)
                if local_dt.hour >= 22 or local_dt.hour < 6:
                    try:
                        val = abs(float(s.state))
                        if val > 10:
                            valid_values.append(val)
                    except: pass
                                    
            if not valid_values:
                return 0
                
            valid_values.sort()
            idx = int(len(valid_values) * 0.1)
            return valid_values[idx]
        except Exception as e:
            _LOGGER.error(f"Error calculating AI history for {entity_id}: {e}")
            return 0

    async def get_solar_forecast(self, lat=None, lon=None):
        """Fetches solar radiation forecast from Open-Meteo."""
        try:
            lat = lat if lat else self.hass.config.latitude
            lon = lon if lon else self.hass.config.longitude
            url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=shortwave_radiation_sum&timezone=auto&shortwave_radiation_unit=mj_per_m_square"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        if "daily" in data and "shortwave_radiation_sum" in data["daily"]:
                            rad_tomorrow = data["daily"]["shortwave_radiation_sum"][1]
                            return float(rad_tomorrow)
        except Exception as e:
            _LOGGER.error(f"Error fetching solar forecast: {e}")
        return None

    async def async_run(self):
        """Main loop execution."""
        _LOGGER.info("OpenKairo Mining Engine started")
        while True:
            try:
                current_time = time.time()
                last_update = self.hass.data.get(DOMAIN, {}).get("mempool_last_update", 0)
                if current_time - last_update > 600:
                    await self.update_mempool_data()

                config = self.hass.data.get(DOMAIN, {}).get("config", {})
                miners = config.get("miners", [])
                sorted_miners = sorted(miners, key=lambda x: int(x.get("priority", 99)))

                # Initialize global surplus if house power sensor is set
                global_pv_surplus = None
                house_sensor = config.get("house_power_sensor")
                if house_sensor:
                    house_state = self.hass.states.get(house_sensor)
                    if house_state and house_state.state not in ["unknown", "unavailable"]:
                        try:
                            # house_power is typically positive for consumption, negative for injection (surplus)
                            # so surplus = -house_power
                            global_pv_surplus = -float(house_state.state)
                        except: pass

                for miner in sorted_miners:
                    try:
                        global_pv_surplus = await self._process_miner(miner, global_pv_surplus)
                    except Exception as miner_err:
                        _LOGGER.error(f"Error processing miner {miner.get('name')}: {miner_err}")

            except Exception as e:
                _LOGGER.error(f"Mining engine loop error: {e}")
            
            await asyncio.sleep(15)

    async def _process_miner(self, miner, global_pv_surplus):
        miner_id = str(miner.get("id", miner.get("name", "Unknown")))
        if miner_id not in self._miner_states:
            self._miner_states[miner_id] = {
                "on_since": None, 
                "off_since": None, 
                "standby_since": None,
                "last_sensor_update": time.time()
            }
        
        state = self._miner_states[miner_id]
        current_time = time.time()
        
        mode = miner.get("mode", "manual")
        miner_name = miner.get("name", "Unknown Miner")
        miner_ip = miner.get("miner_ip")
        
        # --- State Detection ---
        is_on = await self._detect_miner_state(miner, state)
        state["is_on"] = is_on

        # --- Coordinator / Data Sync ---
        coord = None
        if miner_ip:
            from .coordinator import async_get_miner_coordinator
            coord = await async_get_miner_coordinator(self.hass, DOMAIN, miner_ip, miner_name, miner.get("miner_user"), miner.get("miner_password"))
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

        # --- Logic Handling ---
        await self._handle_watchdog(miner, state, is_on, current_time)

        if mode in ["pv", "soc", "offgrid", "heating", "ai_discharge"]:
            turn_on_condition = False
            turn_off_condition = False

            if mode == "pv":
                turn_on_condition, turn_off_condition = await self._process_pv_mode(miner, state, is_on, global_pv_surplus)
            elif mode == "soc":
                turn_on_condition, turn_off_condition = await self._process_soc_mode(miner, state)
            elif mode == "heating":
                turn_on_condition, turn_off_condition = await self._process_heating_mode(miner, state, is_on)
            elif mode == "offgrid":
                turn_on_condition, turn_off_condition = await self._process_offgrid_mode(miner, state)
            elif mode == "ai_discharge":
                turn_on_condition, turn_off_condition = await self._process_ai_discharge_mode(miner, state, is_on, current_time)
            
            # Global Sensor Watchdog
            if current_time - state.get("last_sensor_update", current_time) > 300:
                _LOGGER.warning(f"[{miner_name}] Sensor-Timeout (>5 Min)! Schalte sicherheitshalber AB.")
                turn_on_condition = False
                turn_off_condition = True
                state["log_reason_off"] = "(Sicherheits-Stopp: Sensor-Daten veraltet/tot)"

            # Execution
            await self._execute_conditions(miner, state, is_on, turn_on_condition, turn_off_condition, coord, current_time)
            
        elif mode == "manual":
            state["on_since"] = None
            state["off_since"] = None
            state["ramping"] = None

        # Continuous Scaling
        await self._handle_continuous_scaling(miner, state, is_on, mode, current_time)

        # Update Surplus for next miner in loop
        if mode == "pv" and is_on:
            power_val = state.get("power", 0)
            if global_pv_surplus is not None:
                global_pv_surplus -= power_val
        
        return global_pv_surplus

    async def _detect_miner_state(self, miner, state):
        miner_switch = miner.get("switch")
        miner_switch_2 = miner.get("switch_2")
        miner_ip = miner.get("miner_ip")
        
        if not miner_switch and miner_ip:
            safe_ip = miner_ip.replace('.', '_')
            patterns = [f"switch.{DOMAIN}_{safe_ip}_switch", f"switch.{DOMAIN}_{safe_ip}_mining_aktiv", f"switch.{safe_ip}_mining_aktiv"]
            for p in patterns:
                if self.hass.states.get(p):
                    miner_switch = p
                    break
        
        switches = [miner_switch] if miner_switch else []
        if miner_switch_2: switches.append(miner_switch_2)
        
        plug_on = True
        standby_plug = miner.get("standby_switch")
        if standby_plug:
            p_state = self.hass.states.get(standby_plug)
            if p_state and p_state.state == "off": plug_on = False

        is_on = all(self.hass.states.get(s).state == "on" if self.hass.states.get(s) else False for s in switches)
        if not plug_on: is_on = False
        
        # Power detection fallback
        p_sensor = miner.get("power_consumption_sensor")
        if not is_on and p_sensor:
            p_state = self.hass.states.get(p_sensor)
            if p_state and p_state.state not in ["unknown", "unavailable"]:
                try:
                    if float(p_state.state) > 50: is_on = True
                except: pass
        
        state["switches"] = switches # Store for execution
        return is_on

    async def _handle_watchdog(self, miner, state, is_on, current_time):
        if not miner.get("standby_watchdog_enabled"):
            state["standby_since"] = None
            return

        watchdog_type = miner.get("watchdog_type", "power")
        target_entity = miner.get("power_entity") if watchdog_type == "limit" else miner.get("power_consumption_sensor")
        standby_switches = [s for s in [miner.get("standby_switch"), miner.get("standby_switch_2")] if s]
        
        if target_entity and standby_switches:
            target_state = self.hass.states.get(target_entity)
            any_on = any(self.hass.states.get(s).state == "on" if self.hass.states.get(s) else False for s in standby_switches)
            
            if target_state and target_state.state not in ["unknown", "unavailable"] and any_on:
                try:
                    current_value = float(target_state.state)
                    standby_threshold = float(miner.get("standby_power", 100))
                    standby_delay_secs = float(miner.get("standby_delay", 10)) * 60
                    
                    if current_value < standby_threshold and is_on:
                        if state.get("standby_since") is None:
                            state["standby_since"] = current_time
                            self.add_log_entry(f"🛡️ {miner.get('name')}: Watchdog Countdown gestartet: {current_value}W < {standby_threshold}W")
                        elif current_time - state["standby_since"] >= standby_delay_secs:
                            msg = f"Watchdog an {miner.get('name')} ausgelöst! Wert {current_value} zu niedrig. Schalte Steckdose AUS."
                            self.add_log_entry(f"🛡️ {msg}")
                            await self.hass.services.async_call("switch", "turn_off", {"entity_id": standby_switches})
                            state["standby_since"] = None
                    else:
                        state["standby_since"] = None
                except: state["standby_since"] = None
            else: state["standby_since"] = None

    async def _process_pv_mode(self, miner, state, is_on, global_pv_surplus):
        pv_sensor = miner.get("pv_sensor")
        if not pv_sensor: return False, False
        
        pv_state = self.hass.states.get(pv_sensor)
        if not pv_state or pv_state.state in ["unknown", "unavailable"]: return False, False
        
        state["last_sensor_update"] = time.time()
        try:
            pv_value = float(pv_state.state)
            on_threshold = float(miner.get("pv_on", 1000))
            off_threshold = float(miner.get("pv_off", 500))
            
            # Surplus balancing (Simplified for modular use)
            effective_pv = global_pv_surplus if global_pv_surplus is not None else pv_value
            
            allow_battery = miner.get("allow_battery", False)
            battery_min_soc = float(miner.get("battery_min_soc", 100))
            battery_soc = 0
            bat_sensor = miner.get("battery_sensor")
            if allow_battery and bat_sensor:
                bat_state = self.hass.states.get(bat_sensor)
                if bat_state and bat_state.state not in ["unknown", "unavailable"]:
                    battery_soc = float(bat_state.state)

            turn_on = False
            if effective_pv >= on_threshold:
                safety_min_soc = battery_min_soc + 2 if not is_on else battery_min_soc
                if not allow_battery or battery_soc >= safety_min_soc:
                    turn_on = True
                    state["log_reason_on"] = f"(PV {effective_pv}W >= {on_threshold}W)"

            # Price Awareness
            price_sensor = miner.get("electricity_price_sensor")
            price_limit = miner.get("grid_price_limit")
            if price_sensor and price_limit is not None:
                p_state = self.hass.states.get(price_sensor)
                if p_state and p_state.state not in ["unknown", "unavailable"]:
                    try:
                        if float(p_state.state) <= float(price_limit):
                            turn_on = True
                            state["log_reason_on"] = f"(Günstiger Netzpreis: {p_state.state} <= {price_limit})"
                    except: pass

            turn_off = False
            if pv_value <= off_threshold:
                if not allow_battery or battery_soc < battery_min_soc:
                    turn_off = True
                    state["log_reason_off"] = f"(PV {pv_value}W <= {off_threshold}W)"
            
            return turn_on, turn_off
        except: return False, False

    async def _process_soc_mode(self, miner, state):
        battery_sensor = miner.get("battery_sensor")
        if not battery_sensor: return False, False
        bat_state = self.hass.states.get(battery_sensor)
        if not bat_state or bat_state.state in ["unknown", "unavailable"]: return False, False
        
        state["last_sensor_update"] = time.time()
        try:
            battery_soc = float(bat_state.state)
            soc_on = float(miner.get("soc_on", 90))
            soc_off = float(miner.get("soc_off", 30))
            
            turn_on = battery_soc >= soc_on
            if turn_on: state["log_reason_on"] = f"(SOC {battery_soc}% >= {soc_on}%)"
            
            turn_off = battery_soc <= soc_off
            if turn_off: state["log_reason_off"] = f"(SOC {battery_soc}% <= {soc_off}%)"
            
            return turn_on, turn_off
        except: return False, False

    async def _process_heating_mode(self, miner, state, is_on):
        temp_sensor = miner.get("target_temp_sensor")
        if not temp_sensor: return False, False
        t_state = self.hass.states.get(temp_sensor)
        if not t_state or t_state.state in ["unknown", "unavailable"]: return False, False
        
        state["last_sensor_update"] = time.time()
        try:
            current_temp = float(t_state.state)
            temp_on = float(miner.get("target_temp_on", 21.0))
            temp_off = float(miner.get("target_temp_off", 22.0))
            
            allow_battery = miner.get("allow_battery", False)
            battery_min_soc = float(miner.get("battery_min_soc", 100))
            battery_soc = 100
            bat_sensor = miner.get("battery_sensor")
            if allow_battery and bat_sensor:
                bat_state = self.hass.states.get(bat_sensor)
                if bat_state and bat_state.state not in ["unknown", "unavailable"]:
                    battery_soc = float(bat_state.state)
                else: battery_soc = -1

            turn_on = False
            if current_temp <= temp_on:
                safety_min_soc = battery_min_soc + 2 if not is_on else battery_min_soc
                if not allow_battery or battery_soc >= safety_min_soc:
                    turn_on = True
                    state["log_reason_on"] = f"(Temp {current_temp}°C <= {temp_on}°C)"

            turn_off = current_temp >= temp_off
            if turn_off: state["log_reason_off"] = f"(Temp {current_temp}°C >= {temp_off}°C)"
            
            if allow_battery and 0 <= battery_soc < battery_min_soc:
                turn_off = True
                state["log_reason_off"] = f"(SOC {battery_soc}% < {battery_min_soc}%)"
                
            return turn_on, turn_off
        except: return False, False

    async def _process_offgrid_mode(self, miner, state):
        battery_sensor = miner.get("battery_sensor")
        if not battery_sensor: return False, False
        bat_state = self.hass.states.get(battery_sensor)
        if not bat_state or bat_state.state in ["unknown", "unavailable"]: return False, False
        
        state["last_sensor_update"] = time.time()
        try:
            battery_soc = float(bat_state.state)
            soc_start = float(miner.get("offgrid_soc_start", 90))
            soc_stop = float(miner.get("offgrid_soc_stop", 85))
            
            turn_on = battery_soc >= soc_start
            if turn_on: state["log_reason_on"] = f"(Offgrid SOC {battery_soc}% >= {soc_start}%)"
            
            turn_off = battery_soc <= soc_stop
            if turn_off: state["log_reason_off"] = f"(Offgrid SOC {battery_soc}% <= {soc_stop}%)"
            
            return turn_on, turn_off
        except: return False, False

    async def _process_ai_discharge_mode(self, miner, state, is_on, current_time):
        battery_sensor = miner.get("battery_sensor")
        power_sensor = miner.get("battery_power_sensor") or miner.get("power_consumption_sensor")
        capacity = float(miner.get("battery_capacity", 10))
        target_soc = float(miner.get("target_soc", 10))
        target_time_str = miner.get("target_time", "07:00")
        
        if not battery_sensor or not power_sensor:
            state["ai_status"] = "Konfigurationsfehler"
            return False, False

        bat_state = self.hass.states.get(battery_sensor)
        if not bat_state or bat_state.state in ["unknown", "unavailable"]:
            state["ai_status"] = "Sensor offline"
            return False, False
        
        state["last_sensor_update"] = current_time
        try:
            current_soc = float(bat_state.state)
            
            # Load history (1h cache)
            cache_key = f"ai_load_{power_sensor}"
            last_cache = self.hass.data[DOMAIN].get(f"{cache_key}_time", 0)
            if current_time - last_cache > 3600:
                async def fetch_history():
                    load = await self.get_avg_night_load(power_sensor)
                    self.hass.data[DOMAIN][cache_key] = load
                    self.hass.data[DOMAIN][f"{cache_key}_time"] = time.time()
                self.hass.async_create_task(fetch_history())
            
            avg_load = self.hass.data[DOMAIN].get(cache_key, 250)
            state["ai_avg_p"] = int(avg_load) # Always report house load
            
            # Weather optimization
            weather_enabled = miner.get("weather_optimization_enabled", False)
            weather_info = ""
            if weather_enabled:
                w_cache = "solar_forecast_engine"
                last_w = self.hass.data[DOMAIN].get(f"{w_cache}_time", 0)
                if current_time - last_w > 3600:
                    async def fetch_solar():
                        rad = await self.get_solar_forecast(miner.get("weather_lat"), miner.get("weather_lon"))
                        if rad is not None:
                            self.hass.data[DOMAIN][w_cache] = rad
                            self.hass.data[DOMAIN][f"{w_cache}_time"] = time.time()
                    self.hass.async_create_task(fetch_solar())
                
                forecast_rad = self.hass.data[DOMAIN].get(w_cache)
                if forecast_rad is not None:
                    if forecast_rad > 18: 
                        target_soc = max(0, target_soc - 5)
                        weather_info = f" | ☀️ Sonne ({int(forecast_rad)} MJ/m²) -> Ziel -5%"
                    elif forecast_rad < 5: 
                        target_soc = min(100, target_soc + 5)
                        weather_info = f" | ☁️ Wolken ({int(forecast_rad)} MJ/m²) -> Ziel +5%"
                    else:
                        weather_info = f" | 🌤️ Sonne ({int(forecast_rad)} MJ/m²)"

            # Calculate target time
            now = dt_util.now()
            parts = target_time_str.split(':') if ':' in target_time_str else [7, 0]
            target_dt = now.replace(hour=int(parts[0]), minute=int(parts[1]), second=0, microsecond=0)
            if target_dt <= now: target_dt += timedelta(days=1)
            
            hours_left = (target_dt - now).total_seconds() / 3600
            house_energy_needed = avg_load * hours_left
            battery_energy_available = max(0, (current_soc - target_soc) / 100 * capacity * 1000)
            mining_energy_available = battery_energy_available - house_energy_needed
            
            miner_power = float(miner.get("soft_target_power", 1200))
            if is_on and state.get("power", 0) > 5: miner_power = state["power"]

            if mining_energy_available <= 0:
                state["ai_status"] = f"Haus ({int(house_energy_needed)}Wh) vs Akku ({int(battery_energy_available)}Wh){weather_info}"
                state["log_reason_off"] = f"(AI: Keine Reserve{weather_info})"
                state["ai_start_time"] = "--:--"
                state["ai_runtime"] = 0.0
                state["ai_energy_wh"] = 0
                return False, True
            else:
                runtime_hours = min(mining_energy_available / miner_power, hours_left)
                start_time_dt = target_dt - timedelta(hours=runtime_hours)
                state["ai_start_time"] = start_time_dt.strftime("%H:%M")
                state["ai_runtime"] = round(runtime_hours, 1)
                state["ai_energy_wh"] = int(mining_energy_available)
                
                if now >= start_time_dt:
                    state["ai_status"] = f"Aktiv bis {target_time_str}{weather_info}"
                    state["log_reason_on"] = f"(AI Startzeit erreicht: {state['ai_start_time']})"
                    return True, False
                else:
                    state["ai_status"] = f"Start geplant um {state['ai_start_time']} Uhr{weather_info}"
                    state["log_reason_off"] = f"(AI Wartet auf Startzeit)"
                    return False, True
        except: return False, False

    async def _execute_conditions(self, miner, state, is_on, turn_on_condition, turn_off_condition, coord, current_time):
        delay_seconds = float(miner.get("delay_minutes", 0)) * 60
        switches = state.get("switches", [])
        miner_name = miner.get("name", "Miner")
        
        if turn_on_condition:
            if state.get("ramping") == "down": state["ramping"] = None; state["off_since"] = None
            
            if is_on or state.get("ramping") == "up": state["on_since"] = None
            elif state["on_since"] is None: state["on_since"] = current_time
            elif current_time - state["on_since"] >= delay_seconds or state["hashrate"] > 0:
                # Actual Turn ON
                if coord and coord.miner_obj:
                    try: await coord.miner_obj.resume_mining(); state["on_since_actual"] = current_time
                    except: pass
                
                # Check Standby Switch recovery
                standby_switches = [s for s in [miner.get("standby_switch"), miner.get("standby_switch_2")] if s]
                if standby_switches:
                    any_off = any(self.hass.states.get(s).state == "off" if self.hass.states.get(s) else False for s in standby_switches)
                    if any_off: await self.hass.services.async_call("switch", "turn_on", {"entity_id": standby_switches})
                
                if not is_on and state.get("ramping") != "up":
                    if miner.get("soft_start_enabled") and miner.get("power_entity"):
                        state["ramping"] = "up"; state["ramping_step"] = 0; state["ramping_last_time"] = 0
                        self.add_log_entry(f"🎢 {miner_name}: Soft-Start gestartet.")
                    else:
                        self.add_log_entry(f"⚡ {miner_name} wird eingeschaltet. {state.get('log_reason_on', '')}")
                        await self.hass.services.async_call("switch", "turn_on", {"entity_id": switches})
                        # Set initial power
                        p_ent = miner.get("power_entity")
                        if p_ent and miner.get("soft_target_power"):
                            await self.hass.services.async_call("number", "set_value", {"entity_id": p_ent, "value": float(miner.get("soft_target_power"))})
        else: state["on_since"] = None

        if turn_off_condition:
            min_run_mins = float(miner.get("min_run_time", 5))
            on_for_secs = (current_time - state.get("on_since_actual", 0)) if state.get("on_since_actual") else 99999
            
            if is_on and on_for_secs < (min_run_mins * 60):
                turn_off_condition = False; state["off_since"] = None
            
            if turn_off_condition:
                if state["off_since"] is None: state["off_since"] = current_time
                elif current_time - state["off_since"] >= delay_seconds:
                    if is_on and state.get("ramping") != "down":
                        if miner.get("soft_stop_enabled") and miner.get("power_entity"):
                            state["ramping"] = "down"; state["ramping_step"] = 0; state["ramping_last_time"] = 0
                            self.add_log_entry(f"🎢 {miner_name}: Soft-Stop gestartet.")
                        else:
                            self.add_log_entry(f"💤 {miner_name} wird ausgeschaltet. {state.get('log_reason_off', '')}")
                            if coord and coord.miner_obj:
                                try: await coord.miner_obj.stop_mining()
                                except: pass
                            await self.hass.services.async_call("switch", "turn_off", {"entity_id": switches})
        else: state["off_since"] = None

        # Ramping Execution
        await self._handle_ramping(miner, state, is_on, coord, current_time)

    async def _handle_ramping(self, miner, state, is_on, coord, current_time):
        ramping = state.get("ramping")
        if not ramping: return
        
        if not is_on and ramping == "up": state["ramping"] = None; return
        
        interval = float(miner.get("soft_interval", 60))
        if current_time - state.get("ramping_last_time", 0) >= interval:
            power_entity = miner.get("power_entity")
            if not power_entity: state["ramping"] = None; return
            
            if ramping == "up":
                steps = [float(s.strip()) for s in str(miner.get("soft_start_steps", "100,500,1000")).split(",")]
                target = float(miner.get("soft_target_power", 1200))
                if state["ramping_step"] < len(steps):
                    val = min(steps[state["ramping_step"]], target)
                    await self.hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": val})
                    if state["ramping_step"] == 0:
                        await self.hass.services.async_call("switch", "turn_on", {"entity_id": state.get("switches", [])})
                    state["ramping_step"] += 1; state["ramping_last_time"] = current_time
                else:
                    await self.hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": target})
                    self.add_log_entry(f"✅ {miner.get('name')}: Soft-Start abgeschlossen.")
                    state["ramping"] = None
            
            elif ramping == "down":
                steps = [float(s.strip()) for s in str(miner.get("soft_stop_steps", "1000,500,100")).split(",")]
                if state["ramping_step"] < len(steps):
                    await self.hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": steps[state["ramping_step"]]})
                    state["ramping_step"] += 1; state["ramping_last_time"] = current_time
                else:
                    if coord and coord.miner_obj:
                        try: await coord.miner_obj.stop_mining()
                        except: pass
                    await self.hass.services.async_call("switch", "turn_off", {"entity_id": state.get("switches", [])})
                    state["ramping"] = None

    async def _handle_continuous_scaling(self, miner, state, is_on, mode, current_time):
        if not miner.get("soft_continuous_scaling") or not is_on or state.get("ramping"): return
        
        power_entity = miner.get("power_entity")
        if not power_entity: return
        
        interval = float(miner.get("soft_interval", 60))
        if current_time - state.get("continuous_last_time", 0) >= interval:
            state["continuous_last_time"] = current_time
            power_state = self.hass.states.get(power_entity)
            if not power_state or power_state.state in ["unknown", "unavailable"]: return
            
            try:
                current_power = float(power_state.state)
                target_power = float(miner.get("soft_target_power", 1200))
                
                if mode == "pv":
                    pv_sensor = miner.get("pv_sensor")
                    if pv_sensor:
                        pv_val = float(self.hass.states.get(pv_sensor).state)
                        if pv_val < target_power:
                            steps = [float(s.strip()) for s in str(miner.get("soft_start_steps", "100,500,1000")).split(",")]
                            fitting = [s for s in steps if s <= pv_val]
                            target_power = max(fitting) if fitting else (min(steps) if steps else target_power)
                
                elif mode == "offgrid":
                    bat_sensor = miner.get("battery_sensor")
                    if bat_sensor:
                        soc = float(self.hass.states.get(bat_sensor).state)
                        s_start = float(miner.get("offgrid_soc_start", 90))
                        s_max = float(miner.get("offgrid_soc_max", 98))
                        p_min = float(miner.get("offgrid_min_power", 400))
                        p_max = float(miner.get("offgrid_max_power", 1400))
                        
                        s_mid = miner.get("offgrid_soc_mid")
                        p_mid = miner.get("offgrid_mid_power")
                        
                        if s_mid and p_mid:
                            s_mid, p_mid = float(s_mid), float(p_mid)
                            if soc <= s_start: target_power = p_min
                            elif soc >= s_max: target_power = p_max
                            elif soc <= s_mid:
                                target_power = p_min + ((soc - s_start) / (max(0.1, s_mid - s_start)) * (p_mid - p_min))
                            else:
                                target_power = p_mid + ((soc - s_mid) / (max(0.1, s_max - s_mid)) * (p_max - p_mid))
                        else:
                            if soc <= s_start: target_power = p_min
                            elif soc >= s_max: target_power = p_max
                            else: target_power = p_min + ((soc - s_start) / (max(0.1, s_max - s_start)) * (p_max - p_min))
                
                if abs(current_power - target_power) > 50:
                    await self.hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": round(target_power)})
            except: pass
