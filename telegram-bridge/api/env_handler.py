"""
Environment variables handler for managing .env file from web UI
"""
import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Path to .env file (relative to telegram-bridge directory)
ENV_FILE_PATH = Path(__file__).parent.parent.parent / ".env"

# Variables that can be managed from web UI
MANAGED_VARS = [
    "WEB_UI_URL",
    "AUTH_USERNAME", 
    "AUTH_PASSWORD",
    "JWT_EXPIRY_HOURS",
    "DEFAULT_TIMEOUT",
    "PERMISSION_TIMEOUT",
    "NOTIFY_TIMEOUT",
    "TELEGRAM_TASK_RESULT_MAX_LENGTH",
    "LOG_LEVEL",
    "ENABLE_DIRECTORY_BROWSER",
    "MAX_UPLOAD_SIZE_MB",
]

# Variables that should be masked in responses
SENSITIVE_VARS = ["AUTH_PASSWORD"]

# Track if env has been modified since server start
_env_dirty = False


def get_env_dirty() -> bool:
    """Check if environment has been modified since server start"""
    return _env_dirty


def set_env_dirty(dirty: bool = True):
    """Set the dirty flag"""
    global _env_dirty
    _env_dirty = dirty


def read_env_file() -> dict:
    """Read all variables from .env file"""
    env_vars = {}
    
    if not ENV_FILE_PATH.exists():
        logger.warning(f".env file not found at {ENV_FILE_PATH}")
        return env_vars
    
    try:
        with open(ENV_FILE_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                # Skip empty lines and comments
                if not line or line.startswith("#"):
                    continue
                # Parse KEY=VALUE
                if "=" in line:
                    key, _, value = line.partition("=")
                    key = key.strip()
                    value = value.strip()
                    # Remove quotes if present
                    if (value.startswith('"') and value.endswith('"')) or \
                       (value.startswith("'") and value.endswith("'")):
                        value = value[1:-1]
                    env_vars[key] = value
    except Exception as e:
        logger.error(f"Failed to read .env file: {e}")
    
    return env_vars


def get_managed_env() -> dict:
    """Get managed environment variables with sensitive values masked"""
    all_vars = read_env_file()
    
    result = {}
    for var in MANAGED_VARS:
        value = all_vars.get(var, "")
        # Also check current environment (might be set via docker-compose)
        if not value:
            value = os.getenv(var, "")
        
        # Mask sensitive variables
        if var in SENSITIVE_VARS and value:
            result[var] = value  # Return actual value, frontend will mask display
        else:
            result[var] = value
    
    return result


def update_env_file(updates: dict) -> bool:
    """Update .env file with new values, preserving comments and unmanaged variables"""
    global _env_dirty
    
    # Read existing file content
    lines = []
    if ENV_FILE_PATH.exists():
        try:
            with open(ENV_FILE_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception as e:
            logger.error(f"Failed to read .env file: {e}")
            return False
    
    # Track which variables we've updated
    updated_vars = set()
    new_lines = []
    
    for line in lines:
        stripped = line.strip()
        
        # Keep empty lines and comments as-is
        if not stripped or stripped.startswith("#"):
            new_lines.append(line)
            continue
        
        # Parse KEY=VALUE
        if "=" in stripped:
            key, _, _ = stripped.partition("=")
            key = key.strip()
            
            # Check if this is a managed variable being updated
            if key in updates and key in MANAGED_VARS:
                value = updates[key]
                # Quote value if it contains spaces or special characters
                if value and (" " in value or '"' in value or "'" in value):
                    value = f'"{value}"'
                new_lines.append(f"{key}={value}\n")
                updated_vars.add(key)
            else:
                # Keep non-managed variables as-is
                new_lines.append(line)
        else:
            new_lines.append(line)
    
    # Add any new managed variables that weren't in the file
    for key, value in updates.items():
        if key in MANAGED_VARS and key not in updated_vars:
            if value:  # Only add if value is not empty
                if " " in value or '"' in value or "'" in value:
                    value = f'"{value}"'
                new_lines.append(f"{key}={value}\n")
    
    # Write back to file
    try:
        with open(ENV_FILE_PATH, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
        
        _env_dirty = True
        logger.info(f"Updated .env file with variables: {list(updates.keys())}")
        return True
    except Exception as e:
        logger.error(f"Failed to write .env file: {e}")
        return False


def get_env_defaults() -> dict:
    """Get default values for managed variables"""
    return {
        "WEB_UI_URL": "http://localhost:3000",
        "AUTH_USERNAME": "admin",
        "AUTH_PASSWORD": "",
        "JWT_EXPIRY_HOURS": "24",
        "DEFAULT_TIMEOUT": "60",
        "PERMISSION_TIMEOUT": "300",
        "NOTIFY_TIMEOUT": "30",
        "TELEGRAM_TASK_RESULT_MAX_LENGTH": "0",
        "LOG_LEVEL": "INFO",
        "ENABLE_DIRECTORY_BROWSER": "true",
        "MAX_UPLOAD_SIZE_MB": "10",
    }
