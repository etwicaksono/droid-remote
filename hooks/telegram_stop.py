#!/usr/bin/env python3
"""
Stop Hook Script

Receives: JSON via stdin with session/transcript info
Action: Send completion notification to Telegram (notification only, no blocking)
Output: Exit code 0 (allow Droid to stop)

Note: For continuing work, use the Telegram bot's task execution feature
which uses 'droid exec' for reliable programmatic control.
"""
import os
import sys
import json
import logging

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import register_session, notify, update_session_status
from formatters import format_session_name, format_stop_message

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    # Skip notification if running via droid exec (task executor)
    if os.environ.get("DROID_EXEC_MODE") == "1":
        logger.info("Running in exec mode, skipping stop notification")
        sys.exit(0)
    
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse input JSON: {e}")
        sys.exit(0)
    
    # Check if we're already in a stop hook loop
    if input_data.get("stop_hook_active", False):
        logger.info("Stop hook already active, allowing stop")
        sys.exit(0)
    
    # Debug: log what Factory sends
    logger.info(f"Received input keys: {list(input_data.keys())}")
    
    # Extract session info - try multiple possible key names
    session_id = (
        input_data.get("session_id") or 
        input_data.get("sessionId") or 
        input_data.get("id") or 
        "unknown"
    )
    project_dir = os.environ.get("FACTORY_PROJECT_DIR", os.getcwd())
    session_name = format_session_name(project_dir, session_id)
    
    # Register/update session
    register_session(session_id, project_dir, session_name)
    
    # Get summary if available
    summary = input_data.get("summary")
    
    # Send stop notification
    message = format_stop_message(session_name, summary)
    
    notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="stop",
        buttons=[]  # No buttons - use Telegram to send new tasks via droid exec
    )
    
    # Update status and allow stop
    update_session_status(session_id, "stopped")
    logger.info(f"Session {session_name} stopped, notification sent")
    sys.exit(0)


if __name__ == "__main__":
    main()
