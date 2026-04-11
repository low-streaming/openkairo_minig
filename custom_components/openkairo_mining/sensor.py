import logging
from homeassistant.components.sensor import (
    SensorEntity,
    SensorDeviceClass,
    SensorStateClass,
    SensorEntityDescription,
)
from homeassistant.const import (
    UnitOfTemperature, 
    PERCENTAGE, 
    UnitOfPower, 
    UnitOfTime,
)
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator
from .utils import _safe_get

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner sensors based on a config entry."""
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
        MinerHashrateSensor(coordinator),
        MinerExpectedHashrateSensor(coordinator),
        MinerTempSensor(coordinator),
        MinerPowerSensor(coordinator),
        MinerEfficiencySensor(coordinator),
        MinerUptimeSensor(coordinator),
    ]
    
    # Dynamically add fan sensors
    data = coordinator.data
    if data and hasattr(data, "fans") and data.fans:
        for i, _ in enumerate(data.fans):
            entities.append(MinerFanSensor(coordinator, i))

    # Dynamically add board sensors
    if data and hasattr(data, "hashboards") and data.hashboards:
        for i, _ in enumerate(data.hashboards):
            entities.append(MinerBoardHashrateSensor(coordinator, i))
            entities.append(MinerBoardTempSensor(coordinator, i))
         
    async_add_entities(entities)

class MinerBaseEntity(CoordinatorEntity):
    """Base class for Miner entities."""
    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True

    @property
    def device_info(self):
        # We try to get manufacturer and model from the coordinator
        make = getattr(self.coordinator, "miner_make", "OpenKairo")
        model = getattr(self.coordinator, "miner_model", "ASIC Miner")
        
        return {
            "identifiers": {(DOMAIN, self.coordinator.miner_ip)},
            "name": self.coordinator.miner_name,
            "manufacturer": make,
            "model": model,
            "configuration_url": f"http://{self.coordinator.miner_ip}",
        }

class MinerHashrateSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Hashrate."""
    _attr_native_unit_of_measurement = "TH/s"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_translation_key = "hashrate"

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_unique_id = f"{self.coordinator.miner_ip}_hashrate"
        self._attr_name = "Hashrate"

    @property
    def native_value(self):
        val = _safe_get(self.coordinator.data, ["hashrate"])
        return round(val, 2) if val is not None else None

class MinerExpectedHashrateSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Expected Hashrate."""
    _attr_native_unit_of_measurement = "TH/s"
    _attr_state_class = SensorStateClass.MEASUREMENT
    
    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_unique_id = f"{self.coordinator.miner_ip}_expected_hashrate"
        self._attr_name = "Ziel-Hashrate"

    @property
    def native_value(self):
        val = _safe_get(self.coordinator.data, ["expected_hashrate", "ideal_hashrate"])
        return round(val, 2) if val is not None else None

class MinerTempSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Temperature."""
    _attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS
    _attr_device_class = SensorDeviceClass.TEMPERATURE
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_unique_id = f"{self.coordinator.miner_ip}_temperature"
        self._attr_name = "Durchschnittliche Temperatur"

    @property
    def native_value(self):
        val = _safe_get(self.coordinator.data, ["temperature_avg", "temperature"])
        return round(val, 1) if val is not None else None

class MinerPowerSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Power Consumption."""
    _attr_native_unit_of_measurement = UnitOfPower.WATT
    _attr_device_class = SensorDeviceClass.POWER
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_unique_id = f"{self.coordinator.miner_ip}_power"
        self._attr_name = "Verbrauch"

    @property
    def native_value(self):
        return _safe_get(self.coordinator.data, ["wattage", "power"])

class MinerEfficiencySensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Efficiency."""
    _attr_native_unit_of_measurement = "J/TH"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_unique_id = f"{self.coordinator.miner_ip}_efficiency"
        self._attr_name = "Effizienz"

    @property
    def native_value(self):
        val = _safe_get(self.coordinator.data, ["efficiency"])
        return round(val, 2) if val is not None else None

class MinerUptimeSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Uptime."""
    _attr_device_class = SensorDeviceClass.DURATION
    _attr_native_unit_of_measurement = UnitOfTime.SECONDS
    
    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_unique_id = f"{self.coordinator.miner_ip}_uptime"
        self._attr_name = "Uptime"

    @property
    def native_value(self):
        return _safe_get(self.coordinator.data, ["uptime"])

class MinerFanSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Miner Fans."""
    _attr_native_unit_of_measurement = "RPM"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator, fan_idx):
        super().__init__(coordinator)
        self.fan_idx = fan_idx
        self._attr_unique_id = f"{self.coordinator.miner_ip}_fan_{fan_idx}"
        self._attr_name = f"Lüfter {fan_idx + 1}"

    @property
    def native_value(self):
        data = self.coordinator.data
        if not data or not hasattr(data, "fans") or len(data.fans) <= self.fan_idx:
            return None
        fan = data.fans[self.fan_idx]
        return getattr(fan, "speed", None) or getattr(fan, "rpm", None)

class MinerBoardHashrateSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Board Hashrate."""
    _attr_native_unit_of_measurement = "TH/s"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator, board_idx):
        super().__init__(coordinator)
        self.board_idx = board_idx
        self._attr_unique_id = f"{self.coordinator.miner_ip}_board_{board_idx}_hashrate"
        self._attr_name = f"Board {board_idx + 1} Hashrate"

    @property
    def native_value(self):
        data = self.coordinator.data
        if not data or not hasattr(data, "hashboards") or len(data.hashboards) <= self.board_idx:
            return None
        return getattr(data.hashboards[self.board_idx], "hashrate", None)

class MinerBoardTempSensor(MinerBaseEntity, SensorEntity):
    """Sensor for Board Temperature."""
    _attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS
    _attr_device_class = SensorDeviceClass.TEMPERATURE
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator, board_idx):
        super().__init__(coordinator)
        self.board_idx = board_idx
        self._attr_unique_id = f"{self.coordinator.miner_ip}_board_{board_idx}_temp"
        self._attr_name = f"Board {board_idx + 1} Temperatur"

    @property
    def native_value(self):
        data = self.coordinator.data
        if not data or not hasattr(data, "hashboards") or len(data.hashboards) <= self.board_idx:
            return None
        return getattr(data.hashboards[self.board_idx], "temp", None)

