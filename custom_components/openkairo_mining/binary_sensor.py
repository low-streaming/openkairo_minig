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
        self._attr_unique_id = f"{self.coordinator.miner_ip}_online"
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
        # If the coordinator has recent data, it is online
        return self.coordinator.last_update_success

class MinerFaultBinarySensor(CoordinatorEntity, BinarySensorEntity):
    """Binary sensor for miner faults."""
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        self._attr_unique_id = f"{self.coordinator.miner_ip}_fault"
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
        # pyasic return faulty boards or errors
        if not self.coordinator.data:
            return False
        
        # Check for faulty boards
        boards = getattr(self.coordinator.data, "hashboards", [])
        for board in boards:
            if not getattr(board, "expected_chips", 0) == getattr(board, "chips", 0):
                return True
        return False
