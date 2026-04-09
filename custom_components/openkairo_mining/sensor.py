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
    if "ip_address" not in config_entry.data:
        return

    ip = config_entry.data["ip_address"]
    name = config_entry.title
    user = config_entry.data.get("username")
    password = config_entry.data.get("password")
    
    coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name, user, password)
    
    # Dummy Config, um die restliche Klasse nicht komplett umschreiben zu müssen
    miner_config = {"id": config_entry.entry_id}
    
    entities = [
        MinerHashrateSensor(coordinator, miner_config),
        MinerTempSensor(coordinator, miner_config),
        MinerPowerSensor(coordinator, miner_config)
    ]
         
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
