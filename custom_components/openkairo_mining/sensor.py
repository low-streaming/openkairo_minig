"""OpenKairo Miner Sensors - Final Consolidated Version."""
import logging

from homeassistant.components.sensor import (
    SensorEntity,
    SensorDeviceClass,
    SensorStateClass,
    SensorEntityDescription,
    EntityCategory,
)
from homeassistant.const import (
    UnitOfTemperature,
    UnitOfPower,
    UnitOfTime,
    REVOLUTIONS_PER_MINUTE,
)
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import MinerDataUpdateCoordinator
from .utils import get_device_info

_LOGGER = logging.getLogger(__name__)

TERA_HASH_PER_SECOND = "TH/s"
JOULES_PER_TERA_HASH = "J/TH"

MINER_SENSOR_DESCRIPTIONS: dict[str, SensorEntityDescription] = {
    "hashrate": SensorEntityDescription(
        key="hashrate",
        translation_key="hashrate",
        native_unit_of_measurement=TERA_HASH_PER_SECOND,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "ideal_hashrate": SensorEntityDescription(
        key="ideal_hashrate",
        translation_key="ideal_hashrate",
        native_unit_of_measurement=TERA_HASH_PER_SECOND,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "temperature": SensorEntityDescription(
        key="temperature",
        translation_key="temperature",
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        state_class=SensorStateClass.MEASUREMENT,
        device_class=SensorDeviceClass.TEMPERATURE,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "power_limit": SensorEntityDescription(
        key="power_limit",
        translation_key="power_limit",
        native_unit_of_measurement=UnitOfPower.WATT,
        state_class=SensorStateClass.MEASUREMENT,
        device_class=SensorDeviceClass.POWER,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "miner_consumption": SensorEntityDescription(
        key="miner_consumption",
        translation_key="miner_consumption",
        native_unit_of_measurement=UnitOfPower.WATT,
        state_class=SensorStateClass.MEASUREMENT,
        device_class=SensorDeviceClass.POWER,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "efficiency": SensorEntityDescription(
        key="efficiency",
        translation_key="efficiency",
        native_unit_of_measurement=JOULES_PER_TERA_HASH,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "uptime": SensorEntityDescription(
        key="uptime",
        translation_key="uptime",
        native_unit_of_measurement=UnitOfTime.SECONDS,
        device_class=SensorDeviceClass.DURATION,
        state_class=SensorStateClass.TOTAL_INCREASING,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
}

BOARD_SENSOR_DESCRIPTIONS: dict[str, SensorEntityDescription] = {
    "board_temperature": SensorEntityDescription(
        key="board_temperature",
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        state_class=SensorStateClass.MEASUREMENT,
        device_class=SensorDeviceClass.TEMPERATURE,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "chip_temperature": SensorEntityDescription(
        key="chip_temperature",
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        state_class=SensorStateClass.MEASUREMENT,
        device_class=SensorDeviceClass.TEMPERATURE,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "board_hashrate": SensorEntityDescription(
        key="board_hashrate",
        native_unit_of_measurement=TERA_HASH_PER_SECOND,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
}

FAN_SENSOR_DESCRIPTIONS: dict[str, SensorEntityDescription] = {
    "fan_speed": SensorEntityDescription(
        key="fan_speed",
        native_unit_of_measurement=REVOLUTIONS_PER_MINUTE,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
}


async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner sensors."""
    if "ip_address" not in config_entry.data: return

    ip = config_entry.data["ip_address"]
    name = config_entry.title

    from .coordinator import async_get_miner_coordinator
    coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name)

    try:
        await coordinator.async_config_entry_first_refresh()
    except: pass

    sensors = []

    # Main sensors
    for key, desc in MINER_SENSOR_DESCRIPTIONS.items():
        sensors.append(MinerSensor(coordinator, key, desc))

    # Board sensors (Always 3 for stability)
    num_boards = 3
    if coordinator.data and coordinator.data.get("board_sensors"):
         num_boards = max(len(coordinator.data["board_sensors"]), 3)
         
    for i in range(num_boards):
        for key, desc in BOARD_SENSOR_DESCRIPTIONS.items():
            sensors.append(MinerBoardSensor(coordinator, i, key, desc))

    # Fan sensors (Always 4 for stability)
    num_fans = 4
    if coordinator.data and coordinator.data.get("fan_sensors"):
         num_fans = max(len(coordinator.data["fan_sensors"]), 4)
         
    for i in range(num_fans):
        sensors.append(MinerFanSensor(coordinator, i, "fan_speed", FAN_SENSOR_DESCRIPTIONS["fan_speed"]))

    async_add_entities(sensors)


class MinerSensor(CoordinatorEntity, SensorEntity):
    def __init__(self, coordinator, sensor, description):
        super().__init__(coordinator)
        self._sensor = sensor
        self.entity_description = description
        self._attr_has_entity_name = True
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_{sensor}"

    @property
    def native_value(self):
        if not self.coordinator.data: return None
        return self.coordinator.data.get("miner_sensors", {}).get(self._sensor)

    @property
    def device_info(self):
        return get_device_info(DOMAIN, self.coordinator)


class MinerBoardSensor(CoordinatorEntity, SensorEntity):
    def __init__(self, coordinator, board_num, sensor, description):
        super().__init__(coordinator)
        self._board_num = board_num
        self._sensor = sensor
        self.entity_description = description
        self._attr_has_entity_name = True
        self._attr_name = f"Board {board_num + 1} {description.key.replace('_', ' ').title()}"
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_board_{board_num}_{sensor}"

    @property
    def native_value(self):
        if not self.coordinator.data: return None
        board_data = self.coordinator.data.get("board_sensors", {}).get(self._board_num)
        return board_data.get(self._sensor) if board_data else None

    @property
    def device_info(self):
        return get_device_info(DOMAIN, self.coordinator)


class MinerFanSensor(CoordinatorEntity, SensorEntity):
    def __init__(self, coordinator, fan_num, sensor, description):
        super().__init__(coordinator)
        self._fan_num = fan_num
        self._sensor = sensor
        self.entity_description = description
        self._attr_has_entity_name = True
        self._attr_name = f"Lüfter {fan_num + 1}"
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_fan_{fan_num}"

    @property
    def native_value(self):
        if not self.coordinator.data: return None
        fan_data = self.coordinator.data.get("fan_sensors", {}).get(self._fan_num)
        return fan_data.get(self._sensor) if fan_data else None

    @property
    def device_info(self):
        return get_device_info(DOMAIN, self.coordinator)
