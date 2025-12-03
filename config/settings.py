"""
Centralized Configuration for Droid Remote Control

All configuration is loaded from .env file at project root.
Both hooks and bridge server import from this module.
"""
import os
from pathlib import Path

# Find project root and load .env
PROJECT_ROOT = Path(__file__).parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

# Load .env file manually (to avoid dotenv dependency in hooks)
def _load_env():
    """Load .env file into os.environ"""
    if not ENV_FILE.exists():
        # Try telegram-bridge/.env as fallback
        fallback = PROJECT_ROOT / "telegram-bridge" / ".env"
        if fallback.exists():
            env_path = fallback
        else:
            return
    else:
        env_path = ENV_FILE
    
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, _, value = line.partition('=')
                key = key.strip()
                value = value.strip()
                # Don't override existing env vars
                if key not in os.environ:
                    os.environ[key] = value

_load_env()


# ================================
# Helper function
# ================================
def get_env(key: str, default: str = "") -> str:
    """Get environment variable with default"""
    return os.getenv(key, default)

def get_env_int(key: str, default: int = 0) -> int:
    """Get environment variable as integer"""
    return int(os.getenv(key, str(default)))

def get_env_bool(key: str, default: bool = False) -> bool:
    """Get environment variable as boolean"""
    val = os.getenv(key, str(default)).lower()
    return val in ('true', '1', 'yes', 'on')


# ================================
# Telegram Configuration
# ================================
TELEGRAM_BOT_TOKEN = get_env("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = get_env("TELEGRAM_CHAT_ID")
TELEGRAM_ALLOWED_USERS = get_env("TELEGRAM_ALLOWED_USERS")

# ================================
# Bridge Server
# ================================
BRIDGE_URL = get_env("BRIDGE_URL", "http://127.0.0.1:8765")
BRIDGE_SECRET = get_env("BRIDGE_SECRET", "")
BRIDGE_HOST = get_env("BRIDGE_HOST", "0.0.0.0")
BRIDGE_PORT = get_env_int("BRIDGE_PORT", 8765)

# ================================
# Web UI
# ================================
WEB_UI_URL = get_env("WEB_UI_URL", "http://localhost:3000")

# ================================
# Authentication
# ================================
AUTH_USERNAME = get_env("AUTH_USERNAME", "admin")
AUTH_PASSWORD = get_env("AUTH_PASSWORD", "changeme123")
JWT_SECRET = get_env("JWT_SECRET", "change-this-to-random-32-char-secret")
JWT_EXPIRY_HOURS = get_env_int("JWT_EXPIRY_HOURS", 24)

# ================================
# Timeouts (in seconds)
# ================================
DEFAULT_TIMEOUT = get_env_int("DEFAULT_TIMEOUT", 300)
PERMISSION_TIMEOUT = get_env_int("PERMISSION_TIMEOUT", 120)
NOTIFY_TIMEOUT = get_env_int("NOTIFY_TIMEOUT", 10)

# ================================
# Telegram Notifications
# ================================
TELEGRAM_TASK_RESULT_MAX_LENGTH = get_env_int("TELEGRAM_TASK_RESULT_MAX_LENGTH", 0)

# ================================
# Logging
# ================================
LOG_LEVEL = get_env("LOG_LEVEL", "INFO")
LOG_FILE = get_env("LOG_FILE", "logs/bridge.log")

# ================================
# Cloudinary (Image Upload)
# ================================
CLOUDINARY_CLOUD_NAME = get_env("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = get_env("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = get_env("CLOUDINARY_API_SECRET")
MAX_UPLOAD_SIZE_MB = get_env_int("MAX_UPLOAD_SIZE_MB", 10)


def log_config(logger=None):
    """Log configuration for debugging (masks sensitive values)"""
    def mask(val: str, show: int = 8) -> str:
        if not val:
            return "(not set)"
        if len(val) <= show:
            return "*" * len(val)
        return val[:show] + "..."
    
    lines = [
        "Configuration loaded:",
        f"  BRIDGE_URL: {BRIDGE_URL}",
        f"  BRIDGE_SECRET: {mask(BRIDGE_SECRET)}",
        f"  WEB_UI_URL: {WEB_UI_URL}",
        f"  AUTH_USERNAME: {AUTH_USERNAME}",
        f"  AUTH_PASSWORD: {'*' * len(AUTH_PASSWORD)} ({len(AUTH_PASSWORD)} chars)",
        f"  JWT_SECRET: {mask(JWT_SECRET)}",
        f"  TELEGRAM_BOT_TOKEN: {mask(TELEGRAM_BOT_TOKEN)}",
        f"  TELEGRAM_CHAT_ID: {TELEGRAM_CHAT_ID}",
    ]
    
    if logger:
        for line in lines:
            logger.info(line)
    else:
        for line in lines:
            print(line)
