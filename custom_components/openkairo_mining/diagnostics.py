"""Diagnostics support for OpenKairo Mining."""
from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN

TO_REDACT = {
    "password",
    "miner_password",
    "ssh_password",
    "api_token",
}

async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Return diagnostics for a config entry."""
    engine = hass.data.get(DOMAIN, {}).get("engine")
    config = hass.data.get(DOMAIN, {}).get("config", {})
    
    # Redact sensitive data from entry
    diag_entry = async_redact_data(entry.as_dict(), TO_REDACT)
    
    # Redact sensitive data from our internal config file
    diag_config = async_redact_data(config, TO_REDACT)
    
    # Collect states from the engine
    miner_states = {}
    if engine:
        for mid, state in engine.miner_states.items():
            # Clean state for diagnostics (remove ramping tasks etc if they were there)
            miner_states[mid] = {k: v for k, v in state.items() if k != "active_ramping_task"}

    # Collect coordinator data
    coordinators = {}
    for mid, coord in hass.data.get(DOMAIN, {}).get("coordinators", {}).items():
        coordinators[mid] = {
            "available": coord.available,
            "failure_count": coord._failure_count,
            "data": coord.data,
        }

    return {
        "entry": diag_entry,
        "internal_config": diag_config,
        "engine_states": miner_states,
        "coordinators": coordinators,
        "mempool": engine.mempool_data if engine else None,
    }
