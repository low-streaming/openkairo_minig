"""Diagnostics support for OpenKairo Mining."""
from __future__ import annotations

import time
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
    "username",
    "miner_user",
    "ssh_username",
}

async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Return diagnostics for a config entry."""
    engine = hass.data.get(DOMAIN, {}).get("engine")
    config = hass.data.get(DOMAIN, {}).get("config", {})

    diag_entry = async_redact_data(entry.as_dict(), TO_REDACT)
    diag_config = async_redact_data(config, TO_REDACT)

    # Engine states (cleaned)
    miner_states = {}
    if engine:
        for mid, state in engine.miner_states.items():
            miner_states[mid] = {k: v for k, v in state.items() if k != "active_ramping_task"}

    # Coordinator summaries
    coordinators = {}
    for mid, coord in hass.data.get(DOMAIN, {}).get("coordinators", {}).items():
        coordinators[mid] = {
            "available": coord.available,
            "failure_count": coord._failure_count,
            "miner_make": coord.miner_make,
            "miner_model": coord.miner_model,
            "last_update_success": coord.last_update_success,
            "data_keys": list(coord.data.keys()) if coord.data else [],
        }

    # Fleet summary
    fleet = {}
    if engine:
        states = engine.miner_states
        fleet = {
            "miners_total": len(states),
            "miners_on": sum(1 for s in states.values() if s.get("is_on")),
            "miners_mining": sum(1 for s in states.values() if s.get("is_mining")),
            "total_power_w": round(sum(float(s.get("power", 0)) for s in states.values() if s.get("is_on")), 1),
            "total_today_energy_wh": round(sum(s.get("today_energy_wh", 0.0) for s in states.values()), 1),
            "temp_alarms": [mid for mid, s in states.items() if s.get("temp_alarm")],
        }

    return {
        "entry": diag_entry,
        "internal_config": diag_config,
        "engine_states": miner_states,
        "coordinators": coordinators,
        "fleet": fleet,
        "mempool": engine.mempool_data if engine else None,
        "btc_price_eur": engine.btc_price if engine else None,
        "engine_log_count": len(engine.logs) if engine else 0,
        "diag_timestamp": int(time.time()),
    }
