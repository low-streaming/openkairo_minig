import logging
from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner switches."""
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
             entities.append(MinerSwitch(coordinator, miner))
             
    async_add_entities(entities)

class MinerSwitch(CoordinatorEntity, SwitchEntity):
    """Switch representation for a Miner."""
    def __init__(self, coordinator, miner_config):
        super().__init__(coordinator)
        self.miner_id = miner_config.get("id")
        self._attr_has_entity_name = True
        self._attr_unique_id = f"{self.coordinator.miner_ip}_switch"
        self._attr_name = f"{self.coordinator.miner_name} Status"

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, self.coordinator.miner_ip)},
            "name": self.coordinator.miner_name,
        }

    @property
    def is_on(self):
        data = self.coordinator.data
        if data and "is_mining" in data:
            return data["is_mining"]
        return False

    async def async_turn_on(self, **kwargs):
        """Turn the miner on."""
        if self.coordinator.miner_obj:
            await self.coordinator.miner_obj.resume_mining()
            await self.coordinator.async_request_refresh()

    async def async_turn_off(self, **kwargs):
        """Turn the miner off."""
        if self.coordinator.miner_obj:
            await self.coordinator.miner_obj.pause_mining()
            await self.coordinator.async_request_refresh()
