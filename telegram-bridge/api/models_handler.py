"""
Models configuration handler.
Manages default models (config/models.json) and custom models (Factory CLI config).
"""

import os
import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Path to default models config
DEFAULT_MODELS_PATH = Path(__file__).parent.parent / "config" / "models.json"

def get_factory_config_path() -> Optional[str]:
    """Get the path to Factory CLI config from environment variable."""
    return os.getenv("FACTORY_CUSTOM_MODEL_CONFIG_PATH")


def read_default_models() -> dict:
    """Read default models configuration."""
    try:
        if DEFAULT_MODELS_PATH.exists():
            with open(DEFAULT_MODELS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read default models config: {e}")
    
    return {
        "models": [],
        "defaultModel": "",
        "reasoningLevels": [],
        "defaultReasoningLevel": "medium",
        "autonomyLevels": [],
        "defaultAutonomyLevel": "high"
    }


def write_default_models(config: dict) -> bool:
    """Write default models configuration."""
    try:
        DEFAULT_MODELS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(DEFAULT_MODELS_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Failed to write default models config: {e}")
        return False


def read_custom_models() -> list:
    """Read custom models from Factory CLI config."""
    config_path = get_factory_config_path()
    if not config_path:
        return []
    
    try:
        path = Path(config_path)
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                config = json.load(f)
                return config.get("custom_models", [])
    except Exception as e:
        logger.error(f"Failed to read Factory CLI config: {e}")
    
    return []


def write_custom_models(models: list) -> bool:
    """Write custom models to Factory CLI config."""
    config_path = get_factory_config_path()
    if not config_path:
        logger.error("FACTORY_CUSTOM_MODEL_CONFIG_PATH not set")
        return False
    
    try:
        path = Path(config_path)
        
        # Read existing config
        config = {}
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                config = json.load(f)
        
        # Update custom_models
        config["custom_models"] = models
        
        # Write back
        with open(path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent="\t")
        
        return True
    except Exception as e:
        logger.error(f"Failed to write Factory CLI config: {e}")
        return False


def get_all_models() -> dict:
    """Get merged default and custom models."""
    default_config = read_default_models()
    custom_models = read_custom_models()
    
    # Add source field to default models
    default_models = []
    for model in default_config.get("models", []):
        default_models.append({**model, "source": "default"})
    
    # Convert custom models to our format
    converted_custom = []
    for cm in custom_models:
        converted_custom.append({
            "id": cm.get("model", ""),
            "name": cm.get("model_display_name", cm.get("model", "")),
            "reasoning": False,  # Default, can be overridden
            "vision": False,     # Default, can be overridden
            "source": "custom",
            "base_url": cm.get("base_url", ""),
            "api_key": cm.get("api_key", ""),
            "provider": cm.get("provider", ""),
            "max_tokens": cm.get("max_tokens", 0),
        })
    
    return {
        "models": default_models + converted_custom,
        "defaultModels": default_models,
        "customModels": converted_custom,
        "defaultModel": default_config.get("defaultModel", ""),
        "reasoningLevels": default_config.get("reasoningLevels", []),
        "defaultReasoningLevel": default_config.get("defaultReasoningLevel", "medium"),
        "autonomyLevels": default_config.get("autonomyLevels", []),
        "defaultAutonomyLevel": default_config.get("defaultAutonomyLevel", "high"),
        "factoryConfigPath": get_factory_config_path(),
    }


def add_default_model(model: dict) -> bool:
    """Add a new default model."""
    config = read_default_models()
    
    # Check if model already exists
    for existing in config.get("models", []):
        if existing.get("id") == model.get("id"):
            return False
    
    config.setdefault("models", []).append({
        "id": model.get("id", ""),
        "name": model.get("name", ""),
        "reasoning": model.get("reasoning", False),
        "vision": model.get("vision", False),
    })
    
    return write_default_models(config)


def update_default_model(model_id: str, model: dict) -> bool:
    """Update an existing default model."""
    config = read_default_models()
    
    for i, existing in enumerate(config.get("models", [])):
        if existing.get("id") == model_id:
            config["models"][i] = {
                "id": model.get("id", model_id),
                "name": model.get("name", ""),
                "reasoning": model.get("reasoning", False),
                "vision": model.get("vision", False),
            }
            return write_default_models(config)
    
    return False


def delete_default_model(model_id: str) -> bool:
    """Delete a default model."""
    config = read_default_models()
    
    original_len = len(config.get("models", []))
    config["models"] = [m for m in config.get("models", []) if m.get("id") != model_id]
    
    if len(config["models"]) < original_len:
        return write_default_models(config)
    
    return False


def set_default_model_selection(model_id: str) -> bool:
    """Set the default model selection."""
    config = read_default_models()
    config["defaultModel"] = model_id
    return write_default_models(config)


def add_custom_model(model: dict) -> bool:
    """Add a new custom model."""
    custom_models = read_custom_models()
    
    # Check if model already exists
    for existing in custom_models:
        if existing.get("model") == model.get("model"):
            return False
    
    custom_models.append({
        "model_display_name": model.get("model_display_name", ""),
        "model": model.get("model", ""),
        "base_url": model.get("base_url", ""),
        "api_key": model.get("api_key", ""),
        "provider": model.get("provider", "generic-chat-completion-api"),
        "max_tokens": model.get("max_tokens", 128000),
    })
    
    return write_custom_models(custom_models)


def update_custom_model(model_id: str, model: dict) -> bool:
    """Update an existing custom model."""
    custom_models = read_custom_models()
    
    for i, existing in enumerate(custom_models):
        if existing.get("model") == model_id:
            # Preserve api_key if not provided
            if not model.get("api_key") and existing.get("api_key"):
                model["api_key"] = existing["api_key"]
            
            custom_models[i] = {
                "model_display_name": model.get("model_display_name", ""),
                "model": model.get("model", model_id),
                "base_url": model.get("base_url", ""),
                "api_key": model.get("api_key", ""),
                "provider": model.get("provider", "generic-chat-completion-api"),
                "max_tokens": model.get("max_tokens", 128000),
            }
            return write_custom_models(custom_models)
    
    return False


def delete_custom_model(model_id: str) -> bool:
    """Delete a custom model."""
    custom_models = read_custom_models()
    
    original_len = len(custom_models)
    custom_models = [m for m in custom_models if m.get("model") != model_id]
    
    if len(custom_models) < original_len:
        return write_custom_models(custom_models)
    
    return False
