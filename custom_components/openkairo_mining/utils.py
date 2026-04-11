import logging

_LOGGER = logging.getLogger(__name__)

def _safe_get(data, keys):
    """Safely get a value from a dictionary or an object."""
    if not data:
        return None
    for key in keys:
        # Check if it's a dictionary
        if isinstance(data, dict):
            if key in data and data[key] is not None:
                return data[key]
        # Check if it's an object with the attribute
        elif hasattr(data, key):
            val = getattr(data, key)
            if val is not None:
                return val
    return None
def get_device_info(DOMAIN, coordinator):
    """Unified device info for all entities."""
    data = coordinator.data or {}
    
    # Use hostname from API if available, else fallback to user-given name or IP
    name = data.get("hostname")
    if not name or name.lower() == "unknown":
        name = coordinator.miner_name
    if not name or name.lower() == "unknown (bos+)":
        name = coordinator.miner_ip

    return {
        "identifiers": {(DOMAIN, coordinator.miner_ip)},
        "manufacturer": data.get("make") or getattr(coordinator, "miner_make", "OpenKairo"),
        "model": data.get("model") or getattr(coordinator, "miner_model", "ASIC Miner"),
        "sw_version": data.get("fw_ver"),
        "name": name,
        "configuration_url": f"http://{coordinator.miner_ip}",
    }
