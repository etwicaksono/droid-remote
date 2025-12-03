#!/usr/bin/env python3
"""
SessionStart Hook Script

Receives: JSON via stdin with session info
Action: Register session and send notification that Droid session started
Output: Exit code 0, optional context in stdout
"""
import os
import sys
import json
import logging
from datetime import datetime

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import register_session, notify, is_bridge_available
from formatters import format_session_name
from config import WEB_UI_URL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    # Debug logging to file
    import tempfile
    log_file = os.path.join(tempfile.gettempdir(), "session_start_debug.log")
    
    def debug_log(msg):
        with open(log_file, "a") as f:
            f.write(f"{datetime.now()}: {msg}\n")
    
    debug_log("=== SessionStart Hook Started ===")
    debug_log(f"DROID_EXEC_MODE: {os.environ.get('DROID_EXEC_MODE', 'not set')}")
    debug_log(f"FACTORY_SESSION_ID: {os.environ.get('FACTORY_SESSION_ID', 'not set')}")
    debug_log(f"FACTORY_PROJECT_DIR: {os.environ.get('FACTORY_PROJECT_DIR', 'not set')}")
    
    # Skip notification if running via droid exec (task executor)
    if os.environ.get("DROID_EXEC_MODE") == "1":
        debug_log("Running in exec mode, skipping")
        sys.exit(0)
    
    # Quick check if bridge is available (300ms timeout)
    if not is_bridge_available():
        debug_log("Bridge not available, skipping")
        sys.exit(0)
    
    try:
        input_data = json.load(sys.stdin)
        debug_log(f"Input data: {json.dumps(input_data, default=str)}")
    except json.JSONDecodeError as e:
        debug_log(f"Failed to parse JSON: {e}")
        sys.exit(0)
    
    # Extract session info - try multiple sources
    session_id = (
        input_data.get("session_id") or 
        input_data.get("sessionId") or
        os.environ.get("FACTORY_SESSION_ID")
    )
    debug_log(f"Extracted session_id: {session_id}")
    
    if not session_id:
        debug_log("No session_id found - exiting with error")
        logger.error("No session_id found in input or environment")
        sys.exit(1)
    project_dir = os.environ.get("FACTORY_PROJECT_DIR", os.getcwd())
    session_name = format_session_name(project_dir, session_id)
    trigger = input_data.get("trigger", "unknown")
    
    # Register session with bridge server
    success = register_session(session_id, project_dir, session_name)
    
    if not success:
        logger.warning("Failed to register session with bridge server")
    
    # Format start time
    start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Build session URL
    session_url = f"{WEB_UI_URL}/session/{session_id}"
    
    # Send start notification
    message = (
        f"▶️ *[{session_name}]* Session Started\n\n"
        f"📁 Project: `{project_dir}`\n"
        f"🕐 Time: {start_time}\n"
        f"🔄 Trigger: {trigger}\n\n"
        f"🔗 [Open in Web UI]({session_url})"
    )
    
    notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="info"  # Use valid NotificationType enum value
    )
    
    logger.info(f"Session {session_name} ({session_id}) started")
    sys.exit(0)


if __name__ == "__main__":
    main()
