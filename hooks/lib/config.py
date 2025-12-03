"""
Hook Configuration - loads from centralized .env

All config is loaded from .env at project root.
"""
import os
from pathlib import Path

# Find project root (.env location)
_current_dir = Path(__file__).parent
_project_root = _current_dir.parent.parent  # hooks/lib -> hooks -> project root

def _load_env():
    """Load .env file into os.environ"""
    # Try project root first
    env_path = _project_root / ".env"
    if not env_path.exists():
        # Fallback to telegram-bridge/.env
        env_path = _project_root / "telegram-bridge" / ".env"
    
    if not env_path.exists():
        return
    
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, _, value = line.partition('=')
                key = key.strip()
                value = value.strip()
                if key not in os.environ:
                    os.environ[key] = value

_load_env()

# ================================
# Helper functions
# ================================
def _get(key: str, default: str = "") -> str:
    return os.getenv(key, default)

def _get_int(key: str, default: int = 0) -> int:
    return int(os.getenv(key, str(default)))

# ================================
# Bridge Server
# ================================
BRIDGE_URL = _get("BRIDGE_URL", "http://127.0.0.1:8765")
BRIDGE_SECRET = _get("BRIDGE_SECRET", "")

# ================================
# Web UI
# ================================
WEB_UI_URL = _get("WEB_UI_URL", "http://localhost:3000")

# ================================
# Timeouts (in seconds)
# ================================
DEFAULT_TIMEOUT = _get_int("DEFAULT_TIMEOUT", 300)
PERMISSION_TIMEOUT = _get_int("PERMISSION_TIMEOUT", 120)
NOTIFY_TIMEOUT = _get_int("NOTIFY_TIMEOUT", 10)

# ================================
# Telegram Notifications
# ================================
TELEGRAM_TASK_RESULT_MAX_LENGTH = _get_int("TELEGRAM_TASK_RESULT_MAX_LENGTH", 0)

# ================================
# Logging
# ================================
LOG_LEVEL = _get("LOG_LEVEL", "INFO")
