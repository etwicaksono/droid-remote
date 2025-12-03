#!/usr/bin/env python3
"""
Notification Hook Script

Receives: JSON via stdin with notification details
Action: Sends Telegram notification
Output: Exit code 0 (success)
"""
import os
import sys
import json
import logging

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import register_session, notify, is_bridge_available
from formatters import format_session_name, format_notification_message

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    # Quick check if bridge is available (300ms timeout)
    if not is_bridge_available():
        logger.warning("Bridge not available, skipping notification")
        sys.exit(0)
    
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse input JSON: {e}")
        sys.exit(0)  # Fail gracefully
    
    # Extract session info (Factory sends camelCase: sessionId)
    session_id = (
        input_data.get("session_id") or 
        input_data.get("sessionId") or 
        os.environ.get("FACTORY_SESSION_ID")
    )
    if not session_id:
        logger.error("No session_id found in input or environment")
        sys.exit(1)
    project_dir = os.environ.get("FACTORY_PROJECT_DIR", os.getcwd())
    session_name = format_session_name(project_dir, session_id)
    
    # Get notification details
    message = input_data.get("message", "Notification from Droid")
    notification_type = input_data.get("type", "info")
    
    # Register/update session
    register_session(session_id, project_dir, session_name)
    
    # Format and send notification
    formatted_message = format_notification_message(
        session_name,
        message,
        notification_type
    )
    
    success = notify(
        session_id=session_id,
        session_name=session_name,
        message=formatted_message,
        notification_type=notification_type
    )
    
    if not success:
        logger.warning("Failed to send notification to bridge server")
    
    sys.exit(0)


if __name__ == "__main__":
    main()
