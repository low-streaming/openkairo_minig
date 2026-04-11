import logging
from homeassistant.components.binary_sensor import (
    BinarySensorEntity,
    BinarySensorDeviceClass,
)
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner binary sensors."""
    if "ip_address" not in config_entry.data:
        return

    ip = config_entry.data["ip_address"]
    name = config_entry.title
    user = config_entry.data.get("username")
    password = config_entry.data.get("password")
    ssh_user = config_entry.data.get("ssh_username")
    ssh_password = config_entry.data.get("ssh_password")
    
    coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name, user, password, ssh_user, ssh_password)
    
    entities = [
        MinerOnlineBinarySensor(coordinator),
        MinerFaultBinarySensor(coordinator),
    ]
    async_add_entities(entities)

class MinerOnlineBinarySensor(CoordinatorEntity, BinarySensorEntity):
    """Binary sensor for miner online status."""
    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_online"
        self._attr_name = "Online"

    @property
    def device_info(self):
        make = getattr(self.coordinator, "miner_make", "OpenKairo")
        model = getattr(self.coordinator, "miner_model", "ASIC Miner")
        return {
            "identifiers": {(DOMAIN, self.coordinator.miner_ip)},
            "name": self.coordinator.miner_name,
            "manufacturer": make,
            "model": model,
        }

    @property
    def is_on(self):
        return self.coordinator.available

class MinerFaultBinarySensor(CoordinatorEntity, BinarySensorEntity):
    """Binary sensor for miner faults."""
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_fault"
        self._attr_name = "Problem erkannt"

    @property
    def device_info(self):
        make = getattr(self.coordinator, "miner_make", "OpenKairo")
        model = getattr(self.coordinator, "miner_model", "ASIC Miner")
        return {
            "identifiers": {(DOMAIN, self.coordinator.miner_ip)},
            "name": self.coordinator.miner_name,
            "manufacturer": make,
            "model": model,
        }

    @property
    def is_on(self):
        if self.coordinator.data and isinstance(self.coordinator.data, dict):
             return self.coordinator.data.get("miner_sensors", {}).get("fault", False)
        return False
