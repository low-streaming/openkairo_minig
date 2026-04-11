"""OpenKairo Miner Numbers - Consolidated."""
import logging
from homeassistant.components.number import NumberEntity, NumberDeviceClass
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.const import UnitOfPower

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator
from .utils import get_device_info

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner number entities."""
    if "ip_address" not in config_entry.data: return

    ip = config_entry.data["ip_address"]
    name = config_entry.title
    coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name)
    
    entities = [MinerPowerLimitNumber(coordinator)]
    async_add_entities(entities)

class MinerPowerLimitNumber(CoordinatorEntity, NumberEntity):
    _attr_device_class = NumberDeviceClass.POWER
    _attr_native_unit_of_measurement = UnitOfPower.WATT
    _attr_native_step = 10

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_power_limit"
        self._attr_name = "Power Limit"
        self._attr_icon = "mdi:speedometer"
        
        entry = coordinator.config_entry
        if entry:
            self._attr_native_min_value = float(entry.data.get("min_power", 100))
            self._attr_native_max_value = float(entry.data.get("max_power", 4000))
        else:
            self._attr_native_min_value = 100.0
            self._attr_native_max_value = 4000.0

    @property
    def device_info(self):
        return get_device_info(DOMAIN, self.coordinator)

    @property
    def available(self) -> bool:
        return self.coordinator.available

    @property
    def native_value(self):
        if self.coordinator.data and isinstance(self.coordinator.data, dict):
            return self.coordinator.data["miner_sensors"].get("power_limit")
        return None

    async def async_set_native_value(self, value: float) -> None:
        if self.coordinator.miner_obj:
            try:
                _LOGGER.info(f"[{self.coordinator.miner_ip}] Setting power limit to {value}W")
                await self.coordinator.miner_obj.set_power_limit(int(value))
                await self.coordinator.async_request_refresh()
            except Exception as e:
                _LOGGER.error(f"Error setting power limit: {e}")
