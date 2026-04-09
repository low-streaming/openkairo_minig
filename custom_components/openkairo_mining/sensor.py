import logging
from homeassistant.components.sensor import (
    SensorEntity,
    SensorDeviceClass,
    SensorStateClass,
)
from homeassistant.const import UnitOfTemperature, PERCENTAGE
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner sensors based on a config entry."""
    config = hass.data[DOMAIN].get("config", {})
    miners = config.get("miners", [])
    
    entities = []
    for miner in miners:
        # Check if miner has an explicit IP or if the switch might be an IP/Host
        ip = miner.get("miner_ip")
        if not ip and miner.get("switch") and "." in miner.get("switch"):
             ip = miner.get("switch")
             
        if ip:
             name = miner.get("name", "Asic")
             user = miner.get("miner_user")
             password = miner.get("miner_password")
             
             coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name, user, password)
             entities.append(MinerHashrateSensor(coordinator, miner))
             entities.append(MinerTempSensor(coordinator, miner))
             entities.append(MinerPowerSensor(coordinator, miner))
             
    async_add_entities(entities)

class MinerBaseEntity(CoordinatorEntity):
    """Base class for Miner entities."""
    def __init__(self, coordinator, miner_config):
        super().__init__(coordinator)
        self.miner_config = miner_config
        self.miner_id = miner_config.get("id")
        self._attr_has_entity_name = True

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, self.coordinator.miner_ip)},
            "name": self.coordinator.miner_name,
            "manufacturer": "OpenKairo Miner",
            "model": "Generic ASIC",
        }

class MinerHashrateSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Hashrate."""
    _attr_native_unit_of_measurement = "TH/s"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_translation_key = "hashrate"

    def __init__(self, coordinator, miner_config):
        super().__init__(coordinator, miner_config)
        self._attr_unique_id = f"{self.coordinator.miner_ip}_hashrate"
        self._attr_name = f"{self.coordinator.miner_name} Hashrate"

    @property
    def native_value(self):
        data = self.coordinator.data
        if data and "hashrate" in data:
            return round(data["hashrate"], 2)
        return None

class MinerTempSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Temperature."""
    _attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS
    _attr_device_class = SensorDeviceClass.TEMPERATURE
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator, miner_config):
        super().__init__(coordinator, miner_config)
        self._attr_unique_id = f"{self.coordinator.miner_ip}_temperature"
        self._attr_name = f"{self.coordinator.miner_name} Temperatur"

    @property
    def native_value(self):
        data = self.coordinator.data
        if data and "temperature" in data:
            return data["temperature"]
        return None

class MinerPowerSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Power Consumption."""
    _attr_native_unit_of_measurement = "W"
    _attr_device_class = SensorDeviceClass.POWER
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator, miner_config):
        super().__init__(coordinator, miner_config)
        self._attr_unique_id = f"{self.coordinator.miner_ip}_power"
        self._attr_name = f"{self.coordinator.miner_name} Verbrauch"

    @property
    def native_value(self):
        data = self.coordinator.data
        if data and "wattage" in data:
            return data["wattage"]
        return None
