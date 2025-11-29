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

from bridge_client import register_session, notify
from formatters import format_session_name

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse input JSON: {e}")
        sys.exit(0)
    
    # Extract session info
    session_id = input_data.get("session_id", "unknown")
    project_dir = os.environ.get("FACTORY_PROJECT_DIR", os.getcwd())
    session_name = format_session_name(project_dir, session_id)
    trigger = input_data.get("trigger", "unknown")
    
    # Register session with bridge server
    success = register_session(session_id, project_dir, session_name)
    
    if not success:
        logger.warning("Failed to register session with bridge server")
    
    # Format start time
    start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Send start notification
    message = (
        f"▶️ *[{session_name}]* Session Started\n\n"
        f"📁 Project: `{project_dir}`\n"
        f"🕐 Time: {start_time}\n"
        f"🔄 Trigger: {trigger}"
    )
    
    notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="start"
    )
    
    logger.info(f"Session {session_name} ({session_id}) started")
    sys.exit(0)


if __name__ == "__main__":
    main()
