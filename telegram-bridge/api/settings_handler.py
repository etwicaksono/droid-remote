"""Factory CLI settings.json handler."""

import os
import re
import json
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Default path for Factory settings
DEFAULT_SETTINGS_PATH = Path.home() / ".factory" / "settings.json"


def get_settings_path() -> Path:
    """Get the Factory settings.json path from env or default."""
    env_path = os.getenv("FACTORY_SETTINGS_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_SETTINGS_PATH


def strip_json_comments(json_str: str) -> str:
    """Remove JavaScript-style comments from JSON string."""
    # Remove single-line comments (// ...)
    json_str = re.sub(r'//.*?$', '', json_str, flags=re.MULTILINE)
    # Remove trailing commas before } or ]
    json_str = re.sub(r',\s*([}\]])', r'\1', json_str)
    return json_str


def read_settings() -> dict[str, Any]:
    """Read Factory settings.json file."""
    settings_path = get_settings_path()
    
    if not settings_path.exists():
        logger.warning(f"Settings file not found: {settings_path}")
        return {}
    
    try:
        content = settings_path.read_text(encoding="utf-8")
        clean_content = strip_json_comments(content)
        settings = json.loads(clean_content)
        logger.info(f"Loaded settings from {settings_path}")
        return settings
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse settings.json: {e}")
        raise ValueError(f"Invalid JSON in settings file: {e}")
    except Exception as e:
        logger.error(f"Failed to read settings: {e}")
        raise


def write_settings(settings: dict[str, Any]) -> None:
    """Write settings to Factory settings.json file."""
    settings_path = get_settings_path()
    
    # Ensure directory exists
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        # Write with pretty formatting
        content = json.dumps(settings, indent=2, ensure_ascii=False)
        settings_path.write_text(content, encoding="utf-8")
        logger.info(f"Saved settings to {settings_path}")
    except Exception as e:
        logger.error(f"Failed to write settings: {e}")
        raise


def validate_settings(settings: dict[str, Any]) -> list[str]:
    """Validate settings and return list of errors."""
    errors = []
    
    # Validate model
    if "model" in settings and not isinstance(settings["model"], str):
        errors.append("model must be a string")
    
    # Validate reasoningEffort
    valid_reasoning = ["off", "low", "medium", "high"]
    if "reasoningEffort" in settings and settings["reasoningEffort"] not in valid_reasoning:
        errors.append(f"reasoningEffort must be one of: {valid_reasoning}")
    
    # Validate autonomyMode
    valid_autonomy = ["auto-low", "auto-medium", "auto-high"]
    if "autonomyMode" in settings and settings["autonomyMode"] not in valid_autonomy:
        errors.append(f"autonomyMode must be one of: {valid_autonomy}")
    
    # Validate boolean fields
    bool_fields = [
        "cloudSessionSync", "enableCompletionBell", "enableCustomDroids",
        "includeCoAuthoredByDroid", "enableDroidShield", "enableReadinessReport",
        "allowBackgroundProcesses", "showThinkingInMainView"
    ]
    for field in bool_fields:
        if field in settings and not isinstance(settings[field], bool):
            errors.append(f"{field} must be a boolean")
    
    # Validate soundFocusMode
    valid_focus = ["always", "focused", "never"]
    if "soundFocusMode" in settings and settings["soundFocusMode"] not in valid_focus:
        errors.append(f"soundFocusMode must be one of: {valid_focus}")
    
    # Validate command lists
    list_fields = ["commandAllowlist", "commandDenylist"]
    for field in list_fields:
        if field in settings:
            if not isinstance(settings[field], list):
                errors.append(f"{field} must be an array")
            elif not all(isinstance(item, str) for item in settings[field]):
                errors.append(f"{field} must contain only strings")
    
    # Validate hooks
    if "hooks" in settings:
        if not isinstance(settings["hooks"], dict):
            errors.append("hooks must be an object")
        else:
            valid_hook_events = [
                "PreToolUse", "PostToolUse", "UserPromptSubmit",
                "Notification", "Stop", "SubagentStop",
                "SessionStart", "SessionEnd"
            ]
            for event, hook_list in settings["hooks"].items():
                if event not in valid_hook_events:
                    errors.append(f"Unknown hook event: {event}")
                if not isinstance(hook_list, list):
                    errors.append(f"hooks.{event} must be an array")
    
    return errors


def get_settings_summary() -> dict[str, Any]:
    """Get a summary of current settings for display."""
    settings = read_settings()
    return {
        "path": str(get_settings_path()),
        "exists": get_settings_path().exists(),
        "settings": settings
    }
