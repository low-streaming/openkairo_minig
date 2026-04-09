import logging
from homeassistant.components.number import NumberEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner number entities."""
    config = hass.data[DOMAIN].get("config", {})
    miners = config.get("miners", [])
    
    entities = []
    for miner in miners:
        if miner.get("switch") and "." not in miner.get("switch"):
             ip = miner.get("switch")
             name = miner.get("name", "Asic")
             
             coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name)
             entities.append(MinerPowerLimit(coordinator, miner))
             
    async_add_entities(entities)

class MinerPowerLimit(CoordinatorEntity, NumberEntity):
    """Number entity for Miner Power Limit."""
    _attr_native_min_value = 100
    _attr_native_max_value = 4000
    _attr_native_step = 10
    _attr_native_unit_of_measurement = "W"

    def __init__(self, coordinator, miner_config):
        super().__init__(coordinator)
        self.miner_id = miner_config.get("id")
        self._attr_has_entity_name = True
        self._attr_unique_id = f"{self.coordinator.miner_ip}_power_limit"
        self._attr_name = "Power Limit"

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, self.coordinator.miner_ip)},
            "name": self.coordinator.miner_name,
        }

    @property
    def native_value(self):
        data = self.coordinator.data
        if data and "wattage_limit" in data:
            return data["wattage_limit"]
        return None

    async def async_set_native_value(self, value):
        """Update the power limit."""
        if self.coordinator.miner_obj:
            await self.coordinator.miner_obj.set_power_limit(int(value))
            await self.coordinator.async_request_refresh()
