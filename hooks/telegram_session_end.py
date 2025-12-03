#!/usr/bin/env python3
"""
SessionEnd Hook Script

Receives: JSON via stdin with session info and end reason
Action: Send notification that Droid session ended and cleanup
Output: Exit code 0
"""
import os
import sys
import json
import logging
from datetime import datetime

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import notify, update_session_status, is_bridge_available
from formatters import format_session_name

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    # Skip notification if running via droid exec (task executor)
    if os.environ.get("DROID_EXEC_MODE") == "1":
        logger.info("Running in exec mode, skipping session end notification")
        sys.exit(0)
    
    # Quick check if bridge is available (300ms timeout)
    if not is_bridge_available():
        logger.warning("Bridge not available, skipping session end notification")
        sys.exit(0)
    
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse input JSON: {e}")
        sys.exit(0)
    
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
    reason = input_data.get("reason", "unknown")
    
    # Format end time
    end_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Map reason to friendly message
    reason_messages = {
        "prompt_input_exit": "User exited the prompt",
        "task_completed": "Task completed successfully",
        "error": "Session ended due to error",
        "timeout": "Session timed out",
        "user_interrupt": "User interrupted the session",
    }
    reason_text = reason_messages.get(reason, reason)
    
    # Send end notification
    message = (
        f"⏹️ *[{session_name}]* Session Ended\n\n"
        f"📁 Project: `{project_dir}`\n"
        f"🕐 Time: {end_time}\n"
        f"📋 Reason: {reason_text}"
    )
    
    notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="info"
    )
    
    # Unregister session from bridge server
    unregister_session(session_id)
    
    logger.info(f"Session {session_name} ({session_id}) ended: {reason}")
    sys.exit(0)


if __name__ == "__main__":
    main()
