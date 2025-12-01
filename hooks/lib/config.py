"""
Centralized Configuration for Hook Scripts
Edit values below to configure the system.
"""

# ================================
# Bridge Server
# ================================
BRIDGE_URL = "http://127.0.0.1:8765"
BRIDGE_SECRET = "droid-bridge-secret-2025"

# ================================
# Web UI
# ================================
WEB_UI_URL = "http://192.168.100.8:3000"

# ================================
# Timeouts (in seconds)
# ================================
DEFAULT_TIMEOUT = 300
PERMISSION_TIMEOUT = 120
NOTIFY_TIMEOUT = 10

# ================================
# Telegram Notifications
# ================================
TELEGRAM_TASK_RESULT_MAX_LENGTH = 0  # Max chars for task result in Telegram (0 = no limit)

# ================================
# Logging
# ================================
LOG_LEVEL = "INFO"
