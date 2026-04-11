import logging
from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator
from .utils import _safe_get

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner switches."""
    if "ip_address" not in config_entry.data:
        return

    ip = config_entry.data["ip_address"]
    name = config_entry.title
    user = config_entry.data.get("username")
    password = config_entry.data.get("password")
    ssh_user = config_entry.data.get("ssh_username")
    ssh_password = config_entry.data.get("ssh_password")
    
    coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name, user, password, ssh_user, ssh_password)
    
    miner_config = {"id": config_entry.entry_id}
    entities = [MinerSwitch(coordinator, miner_config)]
             
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
        return _safe_get(self.coordinator.data, ["is_mining"]) is True

    async def async_turn_on(self, **kwargs):
        """Turn the miner on."""
        if self.coordinator.miner_obj:
            await self.coordinator.miner_obj.resume_mining()
            await self.coordinator.async_request_refresh()

    async def async_turn_off(self, **kwargs):
        """Turn the miner off."""
        if self.coordinator.miner_obj:
            await self.coordinator.miner_obj.stop_mining()
            await self.coordinator.async_request_refresh()
