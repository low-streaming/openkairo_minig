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

def _safe_get(data, keys):
    if not data:
        return None
    for key in keys:
        if isinstance(data, dict) and key in data and data[key] is not None:
            return data[key]
        elif hasattr(data, key) and getattr(data, key) is not None:
            return getattr(data, key)
    return None

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
        MinerExpectedHashrateSensor(coordinator, miner_config),
        MinerTempSensor(coordinator, miner_config),
        MinerPowerSensor(coordinator, miner_config),
        MinerEfficiencySensor(coordinator, miner_config),
    ]
    
    # Optional Fans
    for i in range(4):
        entities.append(MinerFanSensor(coordinator, miner_config, i))
         
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
        val = _safe_get(self.coordinator.data, ["hashrate"])
        return round(val, 2) if val is not None else None

class MinerExpectedHashrateSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Expected Hashrate."""
    _attr_native_unit_of_measurement = "TH/s"
    _attr_state_class = SensorStateClass.MEASUREMENT
    
    def __init__(self, coordinator, miner_config):
        super().__init__(coordinator, miner_config)
        self._attr_unique_id = f"{self.coordinator.miner_ip}_expected_hashrate"
        self._attr_name = f"{self.coordinator.miner_name} Ziel-Hashrate"

    @property
    def native_value(self):
        val = _safe_get(self.coordinator.data, ["expected_hashrate", "ideal_hashrate"])
        return round(val, 2) if val is not None else None

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
        val = _safe_get(self.coordinator.data, ["temperature", "env_temp", "temperature_avg"])
        return round(val, 1) if val is not None else None

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
        return _safe_get(self.coordinator.data, ["wattage", "power"])

class MinerEfficiencySensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Efficiency."""
    _attr_native_unit_of_measurement = "W/TH"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator, miner_config):
        super().__init__(coordinator, miner_config)
        self._attr_unique_id = f"{self.coordinator.miner_ip}_efficiency"
        self._attr_name = f"{self.coordinator.miner_name} Effizienz"

    @property
    def native_value(self):
        val = _safe_get(self.coordinator.data, ["efficiency"])
        return round(val, 2) if val is not None else None

class MinerFanSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Fans."""
    _attr_native_unit_of_measurement = "RPM"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator, miner_config, fan_idx):
        super().__init__(coordinator, miner_config)
        self.fan_idx = fan_idx
        self._attr_unique_id = f"{self.coordinator.miner_ip}_fan_{fan_idx}"
        self._attr_name = f"{self.coordinator.miner_name} Lüfter {fan_idx + 1}"

    @property
    def native_value(self):
        val = _safe_get(self.coordinator.data, [f"fan_{self.fan_idx}", f"fan_{self.fan_idx + 1}"])
        return val
