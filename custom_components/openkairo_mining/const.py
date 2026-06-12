DOMAIN = "openkairo_mining"

# Timing constants (seconds)
DEFAULT_UPDATE_INTERVAL = 15        # Coordinator refresh interval
ENGINE_LOOP_INTERVAL = 15           # Mining engine main loop interval
DISCOVERY_COOLDOWN = 300            # Cooldown after failed miner discovery
SENSOR_TIMEOUT = 300                # Sensor staleness threshold before safety-stop
MEMPOOL_REFRESH_INTERVAL = 600      # BTC/mempool data refresh
AI_HISTORY_CACHE_TTL = 3600         # Cache TTL for AI night-load history
SOLAR_FORECAST_CACHE_TTL = 3600     # Cache TTL for solar forecast
REQUEST_REFRESH_COOLDOWN = 5        # Coordinator debounce for request_refresh
DISCOVERY_TIMEOUT = 12              # Parallel miner discovery timeout

# Engine limits
MAX_LOG_ENTRIES = 100               # Max in-memory engine log entries

# Power detection
STANDBY_POWER_THRESHOLD = 50        # Watts: minimum to consider miner "on" via power sensor
