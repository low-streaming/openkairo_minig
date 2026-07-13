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
        # Reflect engine's detected is_on — accurate when a physical switch is configured
        engine = self.hass.data.get(DOMAIN, {}).get("engine")
        if engine and engine.miner_states:
            config = self.hass.data.get(DOMAIN, {}).get("config", {})
            for m in config.get("miners", []):
                if m.get("miner_ip") == self.coordinator.miner_ip:
                    miner_id = str(m.get("id", m.get("name", "Unknown")))
                    miner_state = engine.miner_states.get(miner_id)
                    if miner_state and "is_on" in miner_state:
                        return bool(miner_state["is_on"])
        if self.coordinator.data and isinstance(self.coordinator.data, dict):
            return self.coordinator.data.get("is_mining", False)
        return False

    def _is_api_controlled(self) -> bool:
        """True when this entity is the miner's primary switch (no external physical switch configured)."""
        config = self.hass.data.get(DOMAIN, {}).get("config", {})
        for m in config.get("miners", []):
            if m.get("miner_ip") == self.coordinator.miner_ip:
                sw = m.get("switch", "")
                return not sw or "mining_aktiv" in sw
        return True

    def _avalon_work_mode(self) -> str:
        config = self.hass.data.get(DOMAIN, {}).get("config", {})
        for m in config.get("miners", []):
            if m.get("miner_ip") == self.coordinator.miner_ip:
                return m.get("avalon_work_mode", "normal")
        return "normal"

    async def async_turn_on(self, **kwargs):
        self._set_override(True)
        self.async_write_ha_state()
        if self._is_api_controlled():
            await self.hass.services.async_call(
                DOMAIN, "set_work_mode",
                {"ip_address": self.coordinator.miner_ip, "mode": self._avalon_work_mode()}
            )

    async def async_turn_off(self, **kwargs):
        self._set_override(False)
        self.async_write_ha_state()
        if self._is_api_controlled():
            await self.hass.services.async_call(
                DOMAIN, "set_work_mode",
                {"ip_address": self.coordinator.miner_ip, "mode": "standby"}
            )
