"""OpenKairo Miner Binary Sensors - Consolidated."""
import logging
from homeassistant.components.binary_sensor import (
    BinarySensorEntity,
    BinarySensorDeviceClass,
)
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator
from .utils import get_device_info

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner binary sensors."""
    if "ip_address" not in config_entry.data: return

    ip = config_entry.data["ip_address"]
    name = config_entry.title
    coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name)
    
    entities = [
        MinerOnlineBinarySensor(coordinator),
        MinerFaultBinarySensor(coordinator),
    ]
    async_add_entities(entities)

class MinerOnlineBinarySensor(CoordinatorEntity, BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_online"
        self._attr_name = "Online"

    @property
    def device_info(self):
        return get_device_info(DOMAIN, self.coordinator)

    @property
    def is_on(self):
        return self.coordinator.available

class MinerFaultBinarySensor(CoordinatorEntity, BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_fault"
        self._attr_name = "Problem erkannt"

    @property
    def device_info(self):
        return get_device_info(DOMAIN, self.coordinator)

    @property
    def is_on(self):
        if self.coordinator.data and isinstance(self.coordinator.data, dict):
             return self.coordinator.data.get("miner_sensors", {}).get("fault", False)
        return False
