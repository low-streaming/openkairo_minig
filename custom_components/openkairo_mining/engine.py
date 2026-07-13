import logging
import json
import os
import time
import asyncio
import aiohttp
from datetime import datetime, timedelta
import homeassistant.util.dt as dt_util
from homeassistant.core import HomeAssistant
from .const import (
    DOMAIN,
    ENGINE_LOOP_INTERVAL,
    MEMPOOL_REFRESH_INTERVAL,
    MAX_LOG_ENTRIES,
    AI_HISTORY_CACHE_TTL,
    SOLAR_FORECAST_CACHE_TTL,
    STANDBY_POWER_THRESHOLD,
)

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
        self._logs = self._logs[:MAX_LOG_ENTRIES]
        _LOGGER.info(f"[OpenKairo Log] {message}")

    # Fields that survive a HA restart — everything else resets cleanly.
    _PERSIST_FIELDS = (
        "today_runtime_s", "today_energy_wh", "total_starts", "stats_day",
        "watchdog_last_action",
    )

    @property
    def _state_file(self) -> str:
        return self.hass.config.path(".storage", "openkairo_mining_state.json")

    async def _load_persistent_state(self) -> None:
        """Restore per-miner stats from disk after a HA restart."""
        try:
            def _read_state():
                if not os.path.exists(self._state_file):
                    return None
                with open(self._state_file, encoding="utf-8") as f:
                    return f.read()
            raw = await self.hass.async_add_executor_job(_read_state)
            if not raw:
                return
            saved = json.loads(raw)
            for miner_id, fields in saved.items():
                if miner_id not in self._miner_states:
                    self._miner_states[miner_id] = {}
                for key in self._PERSIST_FIELDS:
                    if key in fields:
                        self._miner_states[miner_id][key] = fields[key]
            _LOGGER.info(f"[OpenKairo] Restored state for {len(saved)} miner(s) from disk.")
        except Exception as e:
            _LOGGER.warning(f"[OpenKairo] Could not load persistent state: {e}")

    async def _save_persistent_state(self) -> None:
        """Write per-miner stats to disk so they survive a HA restart."""
        try:
            payload = {
                mid: {k: s[k] for k in self._PERSIST_FIELDS if k in s}
                for mid, s in self._miner_states.items()
            }
            raw = json.dumps(payload)
            def _write_state():
                with open(self._state_file, "w", encoding="utf-8") as f:
                    f.write(raw)
            await self.hass.async_add_executor_job(_write_state)
        except Exception as e:
            _LOGGER.warning(f"[OpenKairo] Could not save persistent state: {e}")

    async def _publish_mqtt(self, topic: str, payload: str):
        """Publish to MQTT if the integration is configured and available."""
        try:
            if "mqtt" in self.hass.data and hasattr(self.hass.components, "mqtt"):
                await self.hass.components.mqtt.async_publish(
                    self.hass, topic, payload, qos=0, retain=True
                )
        except Exception as e:
            _LOGGER.debug(f"MQTT publish failed for {topic}: {e}")

    async def _publish_miner_state_mqtt(self, miner: dict, state: dict):
        """Publish miner state to MQTT (if mqtt_prefix configured)."""
        config = self.hass.data.get(DOMAIN, {}).get("config", {})
        mqtt_prefix = config.get("mqtt_prefix", "").strip().rstrip("/")
        if not mqtt_prefix:
            return
        import json as _json
        miner_id = str(miner.get("id", miner.get("name", "unknown")))
        miner_slug = miner.get("name", miner_id).lower().replace(" ", "_")
        base = f"{mqtt_prefix}/{miner_slug}"
        payload = {
            "status": state.get("status_msg", "unknown"),
            "is_on": state.get("is_on", False),
            "is_mining": state.get("is_mining", False),
            "hashrate": state.get("hashrate", 0),
            "power_w": state.get("power", 0),
            "temp_c": state.get("temp", 0),
            "mode": miner.get("mode", "manual"),
            "session_runtime_h": round(state.get("session_runtime_s", 0) / 3600, 2),
            "today_energy_wh": round(state.get("today_energy_wh", 0.0), 1),
        }
        await self._publish_mqtt(base, _json.dumps(payload))

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
                    except (ValueError, TypeError):
                        pass
                                    
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
        await self._load_persistent_state()
        _tick = 0
        # Save every 20 ticks (~5 min at 15s interval).
        _SAVE_EVERY = 20
        try:
            while True:
                try:
                    current_time = time.time()
                    last_update = self.hass.data.get(DOMAIN, {}).get("mempool_last_update", 0)
                    if current_time - last_update > MEMPOOL_REFRESH_INTERVAL:
                        await self.update_mempool_data()

                    config = self.hass.data.get(DOMAIN, {}).get("config", {})
                    miners = config.get("miners", [])
                    sorted_miners = sorted(miners, key=lambda x: int(x.get("priority") or 99) if str(x.get("priority", "99")).strip().isdigit() else 99)

                    global_pv_surplus = None
                    house_sensor = config.get("house_power_sensor")
                    if house_sensor:
                        house_state = self.hass.states.get(house_sensor)
                        if house_state and house_state.state not in ["unknown", "unavailable"]:
                            try:
                                global_pv_surplus = -float(house_state.state)
                            except ValueError:
                                _LOGGER.warning(f"House power sensor '{house_sensor}' has non-numeric state: {house_state.state}")

                    for miner in sorted_miners:
                        try:
                            global_pv_surplus = await self._process_miner(miner, global_pv_surplus)
                        except Exception as miner_err:
                            _LOGGER.error(f"Error processing miner {miner.get('name')}: {miner_err}", exc_info=True)

                    _tick += 1
                    if _tick % _SAVE_EVERY == 0:
                        await self._save_persistent_state()

                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    _LOGGER.error(f"Mining engine loop error: {e}", exc_info=True)

                await asyncio.sleep(ENGINE_LOOP_INTERVAL)
        except asyncio.CancelledError:
            _LOGGER.info("OpenKairo Mining Engine stopping (task cancelled)")
            await self._save_persistent_state()
            raise

    async def _process_miner(self, miner, global_pv_surplus):
        miner_id = str(miner.get("id", miner.get("name", "Unknown")))
        if miner_id not in self._miner_states:
            self._miner_states[miner_id] = {}
        state = self._miner_states[miner_id]
        # Set defaults for any field not already present — preserves values
        # restored from disk by _load_persistent_state on HA restart.
        _defaults = {
            "last_sensor_update": time.time(),
            "stats_last_tick": None, "session_runtime_s": 0,
            "session_energy_wh": 0.0, "today_runtime_s": 0,
            "today_energy_wh": 0.0, "stats_day": None, "total_starts": 0,
        }
        for k, v in _defaults.items():
            state.setdefault(k, v)
        # First-time entity validation (non-blocking — only logs warnings)
        self._validate_miner_entities(miner)

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

        # --- Statistics ---
        self._update_statistics(miner_id, state, current_time)

        # --- Logic Handling ---
        if mode in ["pv", "soc", "offgrid", "heating", "ai_discharge"]:
            turn_on_condition = False
            turn_off_condition = False

            # Fleet power budget check: block turn-on if enabling this miner would
            # exceed the global fleet_max_power limit (config root key).
            fleet_budget_raw = self.hass.data.get(DOMAIN, {}).get("config", {}).get("fleet_max_power")
            if fleet_budget_raw and not is_on:
                try:
                    fleet_budget = float(fleet_budget_raw)
                    current_fleet_power = sum(
                        float(s.get("power", 0))
                        for mid, s in self._miner_states.items()
                        if mid != miner_id and s.get("is_on")
                    )
                    estimated = float(miner.get("soft_target_power") or miner.get("max_power") or 1200)
                    if current_fleet_power + estimated > fleet_budget:
                        _LOGGER.info(
                            f"[{miner_name}] Fleet-Budget: {int(current_fleet_power)}W"
                            f" + {int(estimated)}W > {int(fleet_budget)}W — Einschalten blockiert."
                        )
                        state["log_reason_off"] = (
                            f"(Fleet-Budget: {int(current_fleet_power)}+{int(estimated)}W "
                            f"> {int(fleet_budget)}W)"
                        )
                        # Prevent turn-on across all modes this tick
                        mode = "_fleet_blocked"
                except (ValueError, TypeError):
                    pass

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
            
            # Execution
            await self._execute_conditions(miner, state, is_on, turn_on_condition, turn_off_condition, coord, current_time)

        # Watchdog — fires when miner is on but monitored value stays below threshold
        if miner.get("standby_watchdog_enabled") and is_on:
            await self._process_watchdog(miner, state, current_time)

        # Continuous Scaling
        await self._handle_continuous_scaling(miner, state, is_on, mode, current_time, global_pv_surplus)

        # MQTT publish (if configured)
        await self._publish_miner_state_mqtt(miner, state)

        # Update Surplus for next miner in loop
        # Use turn_on/turn_off result to account for miners switched in this tick
        if mode == "pv" and (is_on or turn_on_condition) and not turn_off_condition:
            power_val = state.get("power", 0)
            if global_pv_surplus is not None:
                global_pv_surplus -= power_val

        return global_pv_surplus

    def _resolve_entity(self, entity_id):
        """Return the entity_id that actually exists in HA states, trying common domain-prefix fallbacks."""
        if not entity_id:
            return entity_id
        if self.hass.states.get(entity_id):
            return entity_id
        for candidate in [f"switch.{entity_id.lower()}", entity_id.lower(), f"switch.{entity_id}"]:
            if self.hass.states.get(candidate):
                _LOGGER.warning(
                    f"Switch entity '{entity_id}' not found — auto-resolved to '{candidate}'. "
                    f"Update the miner config to use the full entity_id."
                )
                return candidate
        return entity_id

    async def _detect_miner_state(self, miner, state):
        miner_switch = self._resolve_entity(miner.get("switch"))
        miner_switch_2 = self._resolve_entity(miner.get("switch_2"))
        miner_ip = miner.get("miner_ip")

        if miner_ip and (not miner_switch or not self.hass.states.get(miner_switch)):
            safe_ip = miner_ip.replace('.', '_')
            patterns = [f"switch.{DOMAIN}_{safe_ip}_switch", f"switch.{DOMAIN}_{safe_ip}_mining_aktiv", f"switch.{safe_ip}_mining_aktiv"]
            for p in patterns:
                if self.hass.states.get(p):
                    miner_switch = p
                    break
            if not miner_switch or not self.hass.states.get(miner_switch):
                for eid in self.hass.states.entity_ids("switch"):
                    if safe_ip in eid and "mining_aktiv" in eid:
                        _LOGGER.info(f"[{miner.get('name')}] Auto-resolved switch by IP scan: {eid}")
                        miner_switch = eid
                        break

        if miner_switch and not self.hass.states.get(miner_switch):
            _LOGGER.warning(f"[{miner.get('name')}] Switch entity '{miner_switch}' not found in HA states — is_on detection may fail.")

        switches = [miner_switch] if miner_switch else []
        if miner_switch_2: switches.append(miner_switch_2)
        
        plug_on = True
        standby_plug = miner.get("standby_switch")
        if standby_plug:
            p_state = self.hass.states.get(standby_plug)
            if p_state and p_state.state == "off": plug_on = False

        is_on = bool(switches) and all(self.hass.states.get(s).state == "on" if self.hass.states.get(s) else False for s in switches)
        if not plug_on: is_on = False

        # Power detection fallback — only when no switch explicitly reports "off".
        # Prevents false "is_on=True" when the switch is off but the sensor shows standby power.
        switch_explicitly_off = bool(switches) and all(
            self.hass.states.get(s) is not None and self.hass.states.get(s).state == "off"
            for s in switches
        )
        p_sensor = miner.get("power_consumption_sensor")
        if not is_on and p_sensor and not switch_explicitly_off and plug_on:
            p_state = self.hass.states.get(p_sensor)
            if p_state and p_state.state not in ["unknown", "unavailable"]:
                try:
                    if float(p_state.state) > STANDBY_POWER_THRESHOLD:
                        is_on = True
                except ValueError:
                    pass
        
        state["switches"] = switches # Store for execution
        return is_on

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
                if not allow_battery or battery_soc >= battery_min_soc:
                    turn_on = True
                    state["log_reason_on"] = f"(PV-Überschuss {effective_pv:.0f}W >= {on_threshold}W)"

            # Price Awareness: cheap grid allows mining even if PV is insufficient
            price_sensor = miner.get("electricity_price_sensor")
            price_limit = miner.get("grid_price_limit")
            if not turn_on and price_sensor and price_limit is not None:
                p_state = self.hass.states.get(price_sensor)
                if p_state and p_state.state not in ["unknown", "unavailable"]:
                    try:
                        if float(p_state.state) <= float(price_limit):
                            turn_on = True
                            state["log_reason_on"] = f"(Günstiger Netzpreis: {p_state.state} <= {price_limit})"
                    except (ValueError, TypeError):
                        pass

            turn_off = False
            if effective_pv <= off_threshold:
                if not allow_battery or battery_soc < battery_min_soc:
                    turn_off = True
                    state["log_reason_off"] = f"(PV-Überschuss {effective_pv:.0f}W <= {off_threshold}W)"

            # Cheap grid price prevents turn-off (but does not independently trigger turn-on)
            if turn_off and price_sensor and price_limit is not None:
                p_state = self.hass.states.get(price_sensor)
                if p_state and p_state.state not in ["unknown", "unavailable"]:
                    try:
                        if float(p_state.state) <= float(price_limit):
                            turn_off = False
                            state["log_reason_off"] = ""
                    except (ValueError, TypeError):
                        pass

            return turn_on, turn_off
        except Exception as e:
            _LOGGER.error(f"[{miner.get('name')}] PV mode error: {e}", exc_info=True)
            return False, False

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
            if turn_on: state["log_reason_on"] = f"(SOC {battery_soc:.1f}% >= {soc_on:.1f}%)"

            turn_off = battery_soc <= soc_off
            if turn_off: state["log_reason_off"] = f"(SOC {battery_soc:.1f}% <= {soc_off:.1f}%)"

            return turn_on, turn_off
        except Exception as e:
            _LOGGER.error(f"[{miner.get('name')}] SOC mode error: {e}", exc_info=True)
            return False, False

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
                if not allow_battery or battery_soc >= battery_min_soc:
                    turn_on = True
                    state["log_reason_on"] = f"(Temp {current_temp}°C <= {temp_on}°C)"

            turn_off = current_temp >= temp_off
            if turn_off: state["log_reason_off"] = f"(Temp {current_temp}°C >= {temp_off}°C)"
            
            if allow_battery and 0 <= battery_soc < battery_min_soc:
                turn_off = True
                state["log_reason_off"] = f"(SOC {battery_soc}% < {battery_min_soc}%)"

            return turn_on, turn_off
        except Exception as e:
            _LOGGER.error(f"[{miner.get('name')}] Heating mode error: {e}", exc_info=True)
            return False, False

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
            if turn_on: state["log_reason_on"] = f"(Offgrid SOC {battery_soc:.1f}% >= {soc_start:.1f}%)"

            turn_off = battery_soc <= soc_stop
            if turn_off: state["log_reason_off"] = f"(Offgrid SOC {battery_soc:.1f}% <= {soc_stop:.1f}%)"

            return turn_on, turn_off
        except Exception as e:
            _LOGGER.error(f"[{miner.get('name')}] Offgrid mode error: {e}", exc_info=True)
            return False, False

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
            
            # Load history (cached)
            cache_key = f"ai_load_{power_sensor}"
            last_cache = self.hass.data[DOMAIN].get(f"{cache_key}_time", 0)
            if current_time - last_cache > AI_HISTORY_CACHE_TTL:
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
                if current_time - last_w > SOLAR_FORECAST_CACHE_TTL:
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
            try:
                h, m = [int(x) for x in str(target_time_str).split(":")[:2]]
            except (ValueError, AttributeError):
                _LOGGER.warning(f"[{miner.get('name')}] AI mode: invalid target_time '{target_time_str}', using 07:00")
                h, m = 7, 0
            target_dt = now.replace(hour=h, minute=m, second=0, microsecond=0)
            if target_dt <= now: target_dt += timedelta(days=1)
            
            hours_left = (target_dt - now).total_seconds() / 3600
            house_energy_needed = avg_load * hours_left
            battery_energy_available = max(0, (current_soc - target_soc) / 100 * capacity * 1000)
            mining_energy_available = battery_energy_available - house_energy_needed
            
            miner_power = max(100.0, float(miner.get("soft_target_power") or miner.get("max_power") or 1200))
            if is_on and state.get("power", 0) > 100: miner_power = state["power"]

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
        except Exception as e:
            _LOGGER.error(f"[{miner.get('name')}] AI discharge mode error: {e}", exc_info=True)
            return False, False

    def _validate_miner_entities(self, miner: dict):
        """Log warnings for missing HA entities that are required by the configured mode."""
        name = miner.get("name", "Unknown")
        mode = miner.get("mode", "manual")
        issues = []

        switch = miner.get("switch")
        miner_ip = miner.get("miner_ip")
        if not switch and miner_ip:
            safe_ip = miner_ip.replace(".", "_")
            p1 = f"switch.{DOMAIN}_{safe_ip}_switch"
            p2 = f"switch.{DOMAIN}_{safe_ip}_mining_aktiv"
            if self.hass.states.get(p1):
                switch = p1
            elif self.hass.states.get(p2):
                switch = p2
        if not switch:
            issues.append("Kein Switch konfiguriert/gefunden")

        if mode == "pv" and not miner.get("pv_sensor"):
            issues.append("pv_sensor fehlt (PV-Modus)")
        if mode in ("soc", "offgrid", "ai_discharge") and not miner.get("battery_sensor"):
            issues.append("battery_sensor fehlt")
        if mode == "heating" and not miner.get("target_temp_sensor"):
            issues.append("target_temp_sensor fehlt (Heiz-Modus)")
        if mode == "ai_discharge" and not miner.get("battery_power_sensor") and not miner.get("power_consumption_sensor"):
            issues.append("battery_power_sensor fehlt (AI-Modus)")

        if issues:
            _LOGGER.warning(f"[{name}] Entitäts-Validierung: {'; '.join(issues)}")
        else:
            _LOGGER.info(f"[{name}] Entitäts-Validierung OK (Modus: {mode})")

    def _update_statistics(self, miner_id: str, state: dict, current_time: float):
        """Update per-miner runtime and energy statistics every engine tick."""
        if state.get("stats_last_tick") is None:
            state["stats_last_tick"] = current_time
            state["stats_day"] = datetime.fromtimestamp(current_time).day
            return

        # Day rollover
        today_day = datetime.fromtimestamp(current_time).day
        if state.get("stats_day") != today_day:
            state["today_runtime_s"] = 0
            state["today_energy_wh"] = 0.0
            state["stats_day"] = today_day

        elapsed = current_time - state["stats_last_tick"]
        state["stats_last_tick"] = current_time

        # Only count while actually mining; ignore gaps > 2 loop intervals (HA restart etc.)
        if state.get("is_mining") and 0 < elapsed <= (ENGINE_LOOP_INTERVAL * 2):
            power_w = float(state.get("power", 0))
            energy_wh = (power_w * elapsed) / 3600.0
            state["session_runtime_s"] = state.get("session_runtime_s", 0) + elapsed
            state["session_energy_wh"] = round(state.get("session_energy_wh", 0.0) + energy_wh, 3)
            state["today_runtime_s"] = state.get("today_runtime_s", 0) + elapsed
            state["today_energy_wh"] = round(state.get("today_energy_wh", 0.0) + energy_wh, 3)

    async def _process_watchdog(self, miner, state, current_time):
        """Fire watchdog action when monitored value stays below threshold for the configured delay."""
        threshold = float(miner.get("standby_power", 100))
        delay_s = float(miner.get("standby_delay", 10)) * 60
        action = miner.get("watchdog_action", "off")
        miner_name = miner.get("name", "Miner")
        wtype = miner.get("watchdog_type", "power")

        # Read watched value
        watched_val = None
        if wtype == "limit" and miner.get("power_entity"):
            s = self.hass.states.get(miner["power_entity"])
            if s and s.state not in ["unknown", "unavailable"]:
                try:
                    watched_val = float(s.state)
                except ValueError:
                    pass
        if watched_val is None and miner.get("power_consumption_sensor"):
            s = self.hass.states.get(miner["power_consumption_sensor"])
            if s and s.state not in ["unknown", "unavailable"]:
                try:
                    watched_val = float(s.state)
                except ValueError:
                    pass

        if watched_val is None:
            state.pop("standby_since", None)
            return

        # Cooldown: don't re-trigger until delay has passed since last action
        last_action = state.get("watchdog_last_action", 0)
        cooldown = max(delay_s, 300)
        if current_time - last_action < cooldown:
            state.pop("standby_since", None)
            return

        if watched_val < threshold:
            if not state.get("standby_since"):
                state["standby_since"] = current_time
            elapsed = current_time - state["standby_since"]
            if elapsed >= delay_s:
                state["watchdog_last_action"] = current_time
                state.pop("standby_since", None)
                switches = state.get("switches", [])
                self.add_log_entry(
                    f"🛡️ {miner_name} Watchdog: {watched_val:.0f}W < {threshold:.0f}W "
                    f"für >{int(delay_s / 60)} Min. → Aktion: {action}"
                )
                if action == "off":
                    if switches:
                        await self.hass.services.async_call("switch", "turn_off", {"entity_id": switches})
                elif action == "toggle":
                    if switches:
                        await self.hass.services.async_call("switch", "turn_off", {"entity_id": switches})
                        await asyncio.sleep(5)
                        await self.hass.services.async_call("switch", "turn_on", {"entity_id": switches})
                elif action == "reboot":
                    miner_ip = miner.get("miner_ip")
                    if miner_ip:
                        await self.hass.services.async_call(DOMAIN, "reboot", {"ip_address": miner_ip})
                elif action == "restart_backend":
                    miner_ip = miner.get("miner_ip")
                    if miner_ip:
                        await self.hass.services.async_call(DOMAIN, "restart_backend", {"ip_address": miner_ip})
        else:
            state.pop("standby_since", None)

    async def _execute_conditions(self, miner, state, is_on, turn_on_condition, turn_off_condition, coord, current_time):
        switches = state.get("switches", [])
        miner_name = miner.get("name", "Miner")

        if turn_on_condition and not is_on:
            # Skip turn_on when all switches are unavailable — HA will drop the call anyway,
            # and we'd inflate total_starts. Don't reset the timer so we retry once they recover.
            switches_all_unavailable = bool(switches) and all(
                self.hass.states.get(s) is not None and self.hass.states.get(s).state == "unavailable"
                for s in switches
            )
            if switches_all_unavailable:
                return
            last_cmd_ts = state.get("_last_turn_on_ts", 0)
            if current_time - last_cmd_ts < 90:
                return
            state["_last_turn_on_ts"] = current_time
            state["total_starts"] = state.get("total_starts", 0) + 1
            self.add_log_entry(f"⚡ {miner_name} wird eingeschaltet. {state.get('log_reason_on', '')}")
            await self.hass.services.async_call("switch", "turn_on", {"entity_id": switches})
            p_ent = miner.get("power_entity")
            target_p = miner.get("max_power")
            if p_ent and target_p:
                await self.hass.services.async_call("number", "set_value", {"entity_id": p_ent, "value": float(target_p)})

        elif turn_off_condition and is_on:
            state.pop("_last_turn_on_ts", None)
            self.add_log_entry(f"💤 {miner_name} wird ausgeschaltet. {state.get('log_reason_off', '')}")
            await self.hass.services.async_call("switch", "turn_off", {"entity_id": switches})
            state["session_runtime_s"] = 0
            state["session_energy_wh"] = 0.0

    async def _handle_continuous_scaling(self, miner, state, is_on, mode, current_time, pv_surplus=None):
        power_entity = miner.get("power_entity")
        # PV mode always tracks surplus if a power_entity is configured — no opt-in needed
        pv_auto = (mode == "pv" and bool(power_entity))
        if not pv_auto and not miner.get("soft_continuous_scaling"):
            return
        if not is_on:
            return

        if not power_entity:
            return

        interval = float(miner.get("soft_interval", 60))
        if current_time - state.get("continuous_last_time", 0) < interval:
            return

        state["continuous_last_time"] = current_time
        power_state = self.hass.states.get(power_entity)
        if not power_state or power_state.state in ["unknown", "unavailable"]:
            return

        try:
            current_power = float(power_state.state)
            p_min = float(miner.get("soft_min_power") or miner.get("min_power") or 100)
            p_max = float(miner.get("soft_target_power") or miner.get("max_power") or 1200)
            target_power = p_max
            # PV mode defaults to proportional — tracks surplus smoothly without step config
            scaling_mode = miner.get("scaling_mode", "proportional" if mode == "pv" else "steps")

            if mode == "pv":
                pv_sensor = miner.get("pv_sensor")
                if pv_sensor:
                    pv_state = self.hass.states.get(pv_sensor)
                    if pv_state and pv_state.state not in ["unknown", "unavailable"]:
                        # Use surplus (house-corrected) if available, else raw PV
                        pv_val = pv_surplus if pv_surplus is not None else float(pv_state.state)
                        if scaling_mode == "proportional":
                            # Smooth proportional tracking — use 95% of available surplus
                            factor = float(miner.get("scaling_factor", 0.95))
                            target_power = max(p_min, min(p_max, pv_val * factor))
                        else:
                            # Step-based (original behavior)
                            if pv_val < p_max:
                                steps = [float(s.strip()) for s in str(miner.get("soft_start_steps", "100,500,1000")).split(",")]
                                fitting = [s for s in steps if s <= pv_val]
                                target_power = max(fitting) if fitting else (min(steps) if steps else p_max)

            elif mode == "soc":
                bat_sensor = miner.get("battery_sensor")
                if bat_sensor and miner.get("soc_proportional_scaling"):
                    bat_state = self.hass.states.get(bat_sensor)
                    if bat_state and bat_state.state not in ["unknown", "unavailable"]:
                        soc = float(bat_state.state)
                        soc_on = float(miner.get("soc_on", 90))
                        soc_off = float(miner.get("soc_off", 30))
                        soc_range = max(0.1, soc_on - soc_off)
                        # Scale linearly: p_min at soc_off, p_max at soc_on
                        target_power = p_min + ((soc - soc_off) / soc_range * (p_max - p_min))
                        target_power = max(p_min, min(p_max, target_power))

            elif mode == "offgrid":
                bat_sensor = miner.get("battery_sensor")
                if bat_sensor:
                    bat_state = self.hass.states.get(bat_sensor)
                    if bat_state and bat_state.state not in ["unknown", "unavailable"]:
                        soc = float(bat_state.state)
                        s_start = float(miner.get("offgrid_soc_start", 90))
                        s_max_soc = float(miner.get("offgrid_soc_max", 98))
                        p_min_o = float(miner.get("offgrid_min_power", 400))
                        p_max_o = float(miner.get("offgrid_max_power", 1400))
                        s_mid = miner.get("offgrid_soc_mid")
                        p_mid = miner.get("offgrid_mid_power")
                        if s_mid and p_mid:
                            s_mid, p_mid = float(s_mid), float(p_mid)
                            if soc <= s_start: target_power = p_min_o
                            elif soc >= s_max_soc: target_power = p_max_o
                            elif soc <= s_mid:
                                target_power = p_min_o + ((soc - s_start) / (max(0.1, s_mid - s_start)) * (p_mid - p_min_o))
                            else:
                                target_power = p_mid + ((soc - s_mid) / (max(0.1, s_max_soc - s_mid)) * (p_max_o - p_mid))
                        else:
                            if soc <= s_start: target_power = p_min_o
                            elif soc >= s_max_soc: target_power = p_max_o
                            else:
                                target_power = p_min_o + ((soc - s_start) / (max(0.1, s_max_soc - s_start)) * (p_max_o - p_min_o))

            # Rate-of-change limiting: cap per-tick power step
            max_step = miner.get("power_step_limit")
            if max_step:
                try:
                    delta = target_power - current_power
                    limit = float(max_step)
                    if abs(delta) > limit:
                        target_power = current_power + (limit if delta > 0 else -limit)
                except (ValueError, TypeError):
                    pass

            target_power = round(max(p_min, min(p_max, target_power)))

            if abs(current_power - target_power) > 50:
                _LOGGER.debug(f"[{miner.get('name')}] Scaling {current_power}W -> {target_power}W ({mode}/{scaling_mode})")
                await self.hass.services.async_call("number", "set_value", {"entity_id": power_entity, "value": target_power})
        except Exception as e:
            _LOGGER.debug(f"[{miner.get('name')}] Continuous scaling error: {e}")
