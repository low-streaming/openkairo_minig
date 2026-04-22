"""OpenKairo Miner Selects - Consolidated."""
import logging
from homeassistant.components.select import SelectEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator
from .utils import get_device_info

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner select entities."""
    if "ip_address" not in config_entry.data: return

    ip = config_entry.data["ip_address"]
    name = config_entry.title
    coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name)
    
    entities = [
        MinerWorkModeSelect(coordinator),
        MinerControlModeSelect(coordinator)
    ]
    async_add_entities(entities)

class MinerWorkModeSelect(CoordinatorEntity, SelectEntity):
    _attr_options = ["low", "normal", "high"]

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_work_mode"
        self._attr_name = "Arbeitsmodus"

    @property
    def device_info(self):
        return get_device_info(DOMAIN, self.coordinator)

    @property
    def available(self) -> bool:
        return self.coordinator.available

    @property
    def current_option(self):
        if self.coordinator.data and isinstance(self.coordinator.data, dict):
            return self.coordinator.data.get("miner_sensors", {}).get("mode")
        return None

    async def async_select_option(self, option: str) -> None:
        if self.coordinator.miner_obj:
            if hasattr(self.coordinator.miner_obj, "set_work_mode"):
                try:
                    _LOGGER.info(f"[{self.coordinator.miner_ip}] Setting work mode to {option}")
                    await self.coordinator.miner_obj.set_work_mode(option)
                    await self.coordinator.async_request_refresh()
                except Exception as e:
                    _LOGGER.error(f"Error setting work mode: {e}")

class MinerControlModeSelect(CoordinatorEntity, SelectEntity):
    """Control the automation mode of the miner (manual, pv, soc, etc.)."""
    _attr_options = ["manual", "pv", "soc", "heating", "offgrid", "ai_discharge"]

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_control_mode"
        self._attr_name = "Steuerungsmodus"
        self._attr_icon = "mdi:robot-config"

    @property
    def device_info(self):
        return get_device_info(DOMAIN, self.coordinator)

    @property
    def current_option(self):
        config = self.hass.data.get(DOMAIN, {}).get("config", {})
        miners = config.get("miners", [])
        miner = next((m for m in miners if m.get("miner_ip") == self.coordinator.miner_ip), None)
        if miner:
            return miner.get("mode", "manual")
        return "manual"

    async def async_select_option(self, option: str) -> None:
        from .__init__ import _save_config, _add_log_entry
        config = self.hass.data.get(DOMAIN, {}).get("config", {})
        miners = config.get("miners", [])
        
        found = False
        for m in miners:
            if m.get("miner_ip") == self.coordinator.miner_ip:
                _LOGGER.info(f"[{self.coordinator.miner_ip}] Changing automation mode: {m.get('mode')} -> {option}")
                
                # Wenn wir auf Manuell schalten, merken wir uns den aktuellen Modus für später
                if option == "manual":
                    current_mode = m.get("mode")
                    if current_mode and current_mode != "manual":
                        m["last_auto_mode"] = current_mode
                else:
                    # Wenn wir in einen Automatik-Modus schalten, ist das unser neuer Start-Wert
                    m["last_auto_mode"] = option
                
                # Wenn auf Manuell geschaltet wird -> Alles aus (Not-Aus Logik)
                if option == "manual":
                    switches = [m.get("switch"), m.get("switch_2"), m.get("standby_switch"), m.get("standby_switch_2")]
                    switches = [s for s in switches if s]
                    
                    if not switches:
                        # Auto-Discovery Fallback
                        ip_slug = self.coordinator.miner_ip.replace(".", "_")
                        p1 = f"switch.{DOMAIN}_{ip_slug}_switch"
                        p2 = f"switch.{DOMAIN}_{ip_slug}_mining_aktiv"
                        if self.hass.states.get(p1): switches.append(p1)
                        elif self.hass.states.get(p2): switches.append(p2)
                        
                    if switches:
                        _LOGGER.info(f"[{self.coordinator.miner_ip}] Manual mode selected: Turning off hardware {switches}")
                        await self.hass.services.async_call("switch", "turn_off", {"entity_id": switches})

                m["mode"] = option
                found = True
                break
        
        if found:
            await self.hass.async_add_executor_job(_save_config, self.hass, config)
            _add_log_entry(self.hass, f"🔄 {self.coordinator.miner_name}: Steuermodus auf '{option.upper()}' geändert (via HA)")
            self.async_write_ha_state()
