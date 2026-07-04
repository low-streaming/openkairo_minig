"""OpenKairo Miner Switches - Consolidated."""
import logging
from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator
from .utils import get_device_info

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner switches."""
    if "ip_address" not in config_entry.data: return

    ip = config_entry.data["ip_address"]
    name = config_entry.title
    coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name)

    entities = [MinerMiningSwitch(coordinator)]
    async_add_entities(entities)

class MinerMiningSwitch(CoordinatorEntity, SwitchEntity):
    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        ip_slug = coordinator.miner_ip.replace(".", "_")
        self._attr_unique_id = f"{DOMAIN}_{ip_slug}_mining_aktiv"
        self._attr_name = "Mining Aktiv"
        self._attr_icon = "mdi:hammer-pick"

    def _get_override(self):
        return self.hass.data.get(DOMAIN, {}).get("_switch_overrides", {}).get(self._attr_unique_id)

    def _set_override(self, value):
        self.hass.data.setdefault(DOMAIN, {}).setdefault("_switch_overrides", {})[self._attr_unique_id] = value

    @property
    def device_info(self):
        return get_device_info(DOMAIN, self.coordinator)

    @property
    def available(self) -> bool:
        return True

    @property
    def is_on(self):
        override = self._get_override()
        if override is not None:
            return override
        if self.coordinator.data and isinstance(self.coordinator.data, dict):
            return self.coordinator.data.get("is_mining", False)
        return False

    async def async_turn_on(self, **kwargs):
        self._set_override(True)
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs):
        self._set_override(False)
        self.async_write_ha_state()
