"""OpenKairo Miner Sensors - modeled after hass-miner."""
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
from homeassistant.helpers import entity as entity_helper

from .const import DOMAIN
from .coordinator import MinerDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)

TERA_HASH_PER_SECOND = "TH/s"
JOULES_PER_TERA_HASH = "J/TH"

MINER_SENSOR_DESCRIPTIONS: dict[str, SensorEntityDescription] = {
    "hashrate": SensorEntityDescription(
        key="Hashrate",
        native_unit_of_measurement=TERA_HASH_PER_SECOND,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "ideal_hashrate": SensorEntityDescription(
        key="Ziel-Hashrate",
        native_unit_of_measurement=TERA_HASH_PER_SECOND,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "temperature": SensorEntityDescription(
        key="Durchschnittliche Temperatur",
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        state_class=SensorStateClass.MEASUREMENT,
        device_class=SensorDeviceClass.TEMPERATURE,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "power_limit": SensorEntityDescription(
        key="Power Limit",
        native_unit_of_measurement=UnitOfPower.WATT,
        state_class=SensorStateClass.MEASUREMENT,
        device_class=SensorDeviceClass.POWER,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "miner_consumption": SensorEntityDescription(
        key="Verbrauch",
        native_unit_of_measurement=UnitOfPower.WATT,
        state_class=SensorStateClass.MEASUREMENT,
        device_class=SensorDeviceClass.POWER,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "efficiency": SensorEntityDescription(
        key="Effizienz",
        native_unit_of_measurement=JOULES_PER_TERA_HASH,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
}

BOARD_SENSOR_DESCRIPTIONS: dict[str, SensorEntityDescription] = {
    "board_temperature": SensorEntityDescription(
        key="Board Temperatur",
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        state_class=SensorStateClass.MEASUREMENT,
        device_class=SensorDeviceClass.TEMPERATURE,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "chip_temperature": SensorEntityDescription(
        key="Chip Temperatur",
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        state_class=SensorStateClass.MEASUREMENT,
        device_class=SensorDeviceClass.TEMPERATURE,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    "board_hashrate": SensorEntityDescription(
        key="Board Hashrate",
        native_unit_of_measurement=TERA_HASH_PER_SECOND,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
}

FAN_SENSOR_DESCRIPTIONS: dict[str, SensorEntityDescription] = {
    "fan_speed": SensorEntityDescription(
        key="Lüfter",
        native_unit_of_measurement=REVOLUTIONS_PER_MINUTE,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
}


async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner sensors based on a config entry."""
    if "ip_address" not in config_entry.data:
        return

    ip = config_entry.data["ip_address"]
    name = config_entry.title

    from .coordinator import async_get_miner_coordinator
    coordinator = await async_get_miner_coordinator(
        hass, DOMAIN, ip, name,
        user=config_entry.data.get("username", "root"),
        password=config_entry.data.get("password", ""),
        ssh_user=config_entry.data.get("ssh_username", "root"),
        ssh_password=config_entry.data.get("ssh_password", ""),
    )

    # First refresh to know how many boards/fans
    try:
        await coordinator.async_config_entry_first_refresh()
    except Exception as e:
        _LOGGER.debug(f"First refresh failed for {ip}: {e}")

    sensors = []

    # Main miner sensors
    for sensor_key in MINER_SENSOR_DESCRIPTIONS:
        sensors.append(MinerSensor(coordinator, sensor_key, MINER_SENSOR_DESCRIPTIONS[sensor_key]))

    # Board sensors - use expected_hashboards from miner or fall back to data
    data = coordinator.data or {}
    board_data = data.get("board_sensors", {})

    num_boards = 0
    if coordinator.miner_obj:
        num_boards = getattr(coordinator.miner_obj, "expected_hashboards", 0) or len(board_data)
    else:
        num_boards = len(board_data)

    _LOGGER.debug(f"[{ip}] Setting up {num_boards} board sensor groups")
    for board_num in range(num_boards):
        for sensor_key in BOARD_SENSOR_DESCRIPTIONS:
            sensors.append(MinerBoardSensor(coordinator, board_num, sensor_key, BOARD_SENSOR_DESCRIPTIONS[sensor_key]))

    # Fan sensors
    fan_data = data.get("fan_sensors", {})
    num_fans = 0
    if coordinator.miner_obj:
        num_fans = getattr(coordinator.miner_obj, "expected_fans", 0) or len(fan_data)
    else:
        num_fans = len(fan_data)

    _LOGGER.debug(f"[{ip}] Setting up {num_fans} fan sensors")
    for fan_num in range(num_fans):
        sensors.append(MinerFanSensor(coordinator, fan_num, "fan_speed", FAN_SENSOR_DESCRIPTIONS["fan_speed"]))

    async_add_entities(sensors)


def _device_info(coordinator: MinerDataUpdateCoordinator):
    """Build device info dict."""
    data = coordinator.data or {}
    mac = data.get("mac")
    identifier = mac if mac else coordinator.miner_ip
    return entity_helper.DeviceInfo(
        identifiers={(DOMAIN, identifier)},
        manufacturer=data.get("make") or getattr(coordinator, "miner_make", "OpenKairo"),
        model=data.get("model") or getattr(coordinator, "miner_model", "ASIC Miner"),
        sw_version=data.get("fw_ver"),
        name=coordinator.miner_name,
        configuration_url=f"http://{coordinator.miner_ip}",
    )


class MinerSensor(CoordinatorEntity, SensorEntity):
    """A sensor for top-level miner metrics."""

    def __init__(self, coordinator: MinerDataUpdateCoordinator, sensor: str, description: SensorEntityDescription):
        super().__init__(coordinator)
        self._sensor = sensor
        self.entity_description = description
        self._attr_has_entity_name = True
        self._attr_name = description.key
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_{sensor}"

    @property
    def native_value(self):
        try:
            return self.coordinator.data["miner_sensors"][self._sensor]
        except (TypeError, KeyError):
            return None

    @property
    def available(self) -> bool:
        return self.coordinator.available

    @property
    def device_info(self):
        return _device_info(self.coordinator)


class MinerBoardSensor(CoordinatorEntity, SensorEntity):
    """A sensor for per-board metrics."""

    def __init__(self, coordinator: MinerDataUpdateCoordinator, board_num: int, sensor: str, description: SensorEntityDescription):
        super().__init__(coordinator)
        self._board_num = board_num
        self._sensor = sensor
        self.entity_description = description
        self._attr_has_entity_name = True
        self._attr_name = f"Board {board_num + 1} {description.key}"
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_board_{board_num}_{sensor}"

    @property
    def native_value(self):
        try:
            return self.coordinator.data["board_sensors"][self._board_num][self._sensor]
        except (TypeError, KeyError):
            return None

    @property
    def available(self) -> bool:
        return self.coordinator.available

    @property
    def device_info(self):
        return _device_info(self.coordinator)


class MinerFanSensor(CoordinatorEntity, SensorEntity):
    """A sensor for per-fan metrics."""

    def __init__(self, coordinator: MinerDataUpdateCoordinator, fan_num: int, sensor: str, description: SensorEntityDescription):
        super().__init__(coordinator)
        self._fan_num = fan_num
        self._sensor = sensor
        self.entity_description = description
        self._attr_has_entity_name = True
        self._attr_name = f"Lüfter {fan_num + 1}"
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_fan_{fan_num}"
        self._attr_force_update = True

    @property
    def native_value(self):
        try:
            return self.coordinator.data["fan_sensors"][self._fan_num][self._sensor]
        except (TypeError, KeyError):
            return None

    @property
    def available(self) -> bool:
        return self.coordinator.available

    @property
    def device_info(self):
        return _device_info(self.coordinator)
