import logging
from homeassistant.components.number import NumberEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator
from .utils import _safe_get

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner number entities."""
    if "ip_address" not in config_entry.data:
        return

    ip = config_entry.data["ip_address"]
    name = config_entry.title
    user = config_entry.data.get("username")
    password = config_entry.data.get("password")
    ssh_user = config_entry.data.get("ssh_username")
    ssh_password = config_entry.data.get("ssh_password")
    
    coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name, user, password, ssh_user, ssh_password)
    
    miner_config = {"id": config_entry.entry_id}
    entities = [MinerPowerLimit(coordinator, miner_config)]
             
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
        self._attr_name = f"{self.coordinator.miner_name} Power-Limit"

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, self.coordinator.miner_ip)},
            "name": self.coordinator.miner_name,
        }

    @property
    def native_value(self):
        return _safe_get(self.coordinator.data, ["wattage_limit"])

    async def async_set_native_value(self, value):
        """Update the power limit."""
        if self.coordinator.miner_obj:
            await self.coordinator.miner_obj.set_power_limit(int(value))
            await self.coordinator.async_request_refresh()
