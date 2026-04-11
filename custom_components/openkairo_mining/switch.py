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
    
    entities = [MinerMiningSwitch(coordinator)]
    async_add_entities(entities)

class MinerMiningSwitch(CoordinatorEntity, SwitchEntity):
    """Switch representation for mining status."""
    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        self._attr_unique_id = f"{self.coordinator.miner_ip}_mining_switch"
        self._attr_name = "Mining Aktiv"
        self._attr_icon = "mdi:hammer-pick"

    @property
    def device_info(self):
        make = getattr(self.coordinator, "miner_make", "OpenKairo")
        model = getattr(self.coordinator, "miner_model", "ASIC Miner")
        return {
            "identifiers": {(DOMAIN, self.coordinator.miner_ip)},
            "name": self.coordinator.miner_name,
            "manufacturer": make,
            "model": model,
        }

    @property
    def is_on(self):
        # pyasic return True/False for is_mining
        return self.coordinator.data.is_mining if self.coordinator.data else False

    async def async_turn_on(self, **kwargs):
        """Resume mining."""
        if self.coordinator.miner_obj:
            try:
                await self.coordinator.miner_obj.resume_mining()
                await self.coordinator.async_request_refresh()
            except Exception as e:
                _LOGGER.error(f"Fehler beim Starten des Minings: {e}")

    async def async_turn_off(self, **kwargs):
        """Stop mining."""
        if self.coordinator.miner_obj:
            try:
                await self.coordinator.miner_obj.stop_mining()
                await self.coordinator.async_request_refresh()
            except Exception as e:
                _LOGGER.error(f"Fehler beim Stoppen des Minings: {e}")
