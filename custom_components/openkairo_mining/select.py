import logging
from homeassistant.components.select import SelectEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner select entities."""
    config = hass.data[DOMAIN].get("config", {})
    miners = config.get("miners", [])
    
    entities = []
    for miner in miners:
        ip = miner.get("miner_ip")
        if not ip and miner.get("switch") and "." in miner.get("switch"):
             ip = miner.get("switch")
             
        if ip:
             name = miner.get("name", "Asic")
             user = miner.get("miner_user")
             password = miner.get("miner_password")
             
             coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name, user, password)
             entities.append(MinerWorkModeSelect(coordinator, miner))
             
    async_add_entities(entities)

class MinerWorkModeSelect(CoordinatorEntity, SelectEntity):
    """Select entity for Miner Work Mode."""
    _attr_options = ["low", "normal", "high"]

    def __init__(self, coordinator, miner_config):
        super().__init__(coordinator)
        self.miner_id = miner_config.get("id")
        self._attr_has_entity_name = True
        self._attr_unique_id = f"{self.coordinator.miner_ip}_work_mode"
        self._attr_name = f"{self.coordinator.miner_name} Arbeitsmodus"

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, self.coordinator.miner_ip)},
            "name": self.coordinator.miner_name,
        }

    @property
    def current_option(self):
        # Implementation depends on miner ability to report mode
        return None

    async def async_select_option(self, option):
        """Change the work mode."""
        if self.coordinator.miner_obj:
            if hasattr(self.coordinator.miner_obj, "set_work_mode"):
                await self.coordinator.miner_obj.set_work_mode(option)
                await self.coordinator.async_request_refresh()
