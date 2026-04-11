"""OpenKairo Miner Selects - Consolidated."""
import logging
from homeassistant.components.select import SelectEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator
from .utils import get_device_info

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner select entities."""
    if "ip_address" not in config_entry.data: return

    ip = config_entry.data["ip_address"]
    name = config_entry.title
    coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name)
    
    entities = [MinerWorkModeSelect(coordinator)]
    async_add_entities(entities)

class MinerWorkModeSelect(CoordinatorEntity, SelectEntity):
    _attr_options = ["low", "normal", "high"]

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_work_mode"
        self._attr_name = "Arbeitsmodus"

    @property
    def device_info(self):
        return get_device_info(DOMAIN, self.coordinator)

    @property
    def available(self) -> bool:
        return self.coordinator.available

    @property
    def current_option(self):
        if self.coordinator.data and isinstance(self.coordinator.data, dict):
            return self.coordinator.data.get("miner_sensors", {}).get("mode")
        return None

    async def async_select_option(self, option: str) -> None:
        if self.coordinator.miner_obj:
            if hasattr(self.coordinator.miner_obj, "set_work_mode"):
                try:
                    _LOGGER.info(f"[{self.coordinator.miner_ip}] Setting work mode to {option}")
                    await self.coordinator.miner_obj.set_work_mode(option)
                    await self.coordinator.async_request_refresh()
                except Exception as e:
                    _LOGGER.error(f"Error setting work mode: {e}")
