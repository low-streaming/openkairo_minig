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
