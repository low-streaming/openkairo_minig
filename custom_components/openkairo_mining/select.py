import logging
from homeassistant.components.select import SelectEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import async_get_miner_coordinator

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up OpenKairo Miner select entities."""
    if "ip_address" not in config_entry.data:
        return

    ip = config_entry.data["ip_address"]
    name = config_entry.title
    user = config_entry.data.get("username")
    password = config_entry.data.get("password")
    ssh_user = config_entry.data.get("ssh_username")
    ssh_password = config_entry.data.get("ssh_password")
    
    coordinator = await async_get_miner_coordinator(hass, DOMAIN, ip, name, user, password, ssh_user, ssh_password)
    
    # Not all miners support work modes, but we'll try
    entities = [MinerWorkModeSelect(coordinator)]
    async_add_entities(entities)

class MinerWorkModeSelect(CoordinatorEntity, SelectEntity):
    """Select entity for Miner Work Mode."""
    _attr_options = ["low", "normal", "high"]

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_has_entity_name = True
        self._attr_unique_id = f"{self.coordinator.miner_ip}_work_mode"
        self._attr_name = "Arbeitsmodus"

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
    def current_option(self):
        # Result of pyasic MinerData check
        if self.coordinator.data:
            return getattr(self.coordinator.data, "mode", None)
        return None

    async def async_select_option(self, option: str) -> None:
        """Change the work mode."""
        if self.coordinator.miner_obj:
            if hasattr(self.coordinator.miner_obj, "set_work_mode"):
                try:
                    await self.coordinator.miner_obj.set_work_mode(option)
                    await self.coordinator.async_request_refresh()
                except Exception as e:
                    _LOGGER.error(f"Fehler beim Setzen des Arbeitsmodus: {e}")
