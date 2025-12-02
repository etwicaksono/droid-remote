#!/usr/bin/env python3
"""
UserPromptSubmit hook - Captures user prompts before Droid processes them.
This allows us to save the first CLI instruction to the database.
"""
import json
import os
import sys
import logging

# Setup logging to file (avoid stdout/stderr which interfere with hook output)
LOG_FILE = os.path.join(os.path.dirname(__file__), "logs", "user_prompt.log")
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import bridge client
sys.path.insert(0, os.path.dirname(__file__))
from lib.bridge_client import add_chat_message, emit_cli_thinking, is_bridge_available

# Import stop hook functions for prompt tracking
from telegram_stop import save_last_prompt


def main():
    # Skip if running via droid exec (task executor handles this)
    if os.environ.get("DROID_EXEC_MODE") == "1":
        logger.info("Running in exec mode, skipping user prompt hook")
        sys.exit(0)
    
    # Quick check if bridge is available (300ms timeout)
    if not is_bridge_available():
        logger.warning("Bridge not available, skipping user prompt hook")
        sys.exit(0)
    
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse input JSON: {e}")
        sys.exit(0)
    
    # Extract session info
    session_id = (
        input_data.get("session_id") or 
        input_data.get("sessionId") or 
        "unknown"
    )
    prompt = input_data.get("prompt", "")
    
    if not prompt:
        logger.info("No prompt provided, skipping")
        sys.exit(0)
    
    logger.info(f"Capturing user prompt for session {session_id}: {prompt[:100]}...")
    
    # Save user message to database
    try:
        add_chat_message(
            session_id=session_id,
            msg_type='user',
            content=prompt,
            source='cli'
        )
        logger.info(f"Saved user prompt to database ({len(prompt)} chars)")
    except Exception as e:
        logger.error(f"Failed to save user prompt: {e}")
    
    # Emit "thinking" event to Web UI
    try:
        emit_cli_thinking(session_id, prompt)
        logger.info("Emitted CLI thinking event to Web UI")
    except Exception as e:
        logger.error(f"Failed to emit CLI thinking event: {e}")
    
    # Save prompt for Stop hook notification (to show what prompt triggered the response)
    try:
        save_last_prompt(session_id, prompt)
        logger.info("Saved prompt for Stop hook")
    except Exception as e:
        logger.error(f"Failed to save prompt for Stop hook: {e}")
    
    # Exit 0 to allow prompt to proceed normally
    sys.exit(0)


if __name__ == "__main__":
    main()
