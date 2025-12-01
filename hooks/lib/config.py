"""
Configuration module for hook scripts
Loads environment variables and provides constants
"""
import os
from pathlib import Path

# Load .env file if it exists
def load_env():
    # Get the droid-remote project root (where hooks are configured)
    # This handles cases where hooks are copied to a different location by Factory
    hooks_config_dir = os.environ.get("DROID_REMOTE_DIR", "")
    
    # Multiple possible locations for .env file
    env_paths = [
        # User's home directory
        Path.home() / ".factory" / "telegram-bridge" / ".env",
        # Relative to this config file
        Path(__file__).parent.parent.parent / "telegram-bridge" / ".env",
        # If DROID_REMOTE_DIR is set
        Path(hooks_config_dir) / "telegram-bridge" / ".env" if hooks_config_dir else None,
        # Current working directory
        Path(os.getcwd()) / "telegram-bridge" / ".env",
        Path(os.getcwd()) / ".env",
        # Common installation paths
        Path("D:/Project/AI-Generated/droid-remote/telegram-bridge/.env"),
    ]
    
    for env_path in env_paths:
        if env_path is None:
            continue
        try:
            resolved = env_path.resolve()
            if resolved.exists():
                with open(resolved, "r") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, value = line.split("=", 1)
                            os.environ.setdefault(key.strip(), value.strip())
                break
        except Exception:
            continue

load_env()

# Bridge server configuration
BRIDGE_URL = os.getenv("BRIDGE_URL", "http://127.0.0.1:8765")
BRIDGE_SECRET = os.getenv("BRIDGE_SECRET", "")

# Web UI URL (for session links in notifications)
WEB_UI_URL = os.getenv("WEB_UI_URL", "http://127.0.0.1:3000")

# Timeouts (in seconds)
DEFAULT_TIMEOUT = int(os.getenv("DEFAULT_TIMEOUT", "300"))
PERMISSION_TIMEOUT = int(os.getenv("PERMISSION_TIMEOUT", "120"))
NOTIFY_TIMEOUT = int(os.getenv("NOTIFY_TIMEOUT", "10"))

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
