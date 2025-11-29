#!/usr/bin/env python3
"""
Stop Hook Script

Receives: JSON via stdin with session/transcript info
Action: 
  1. Send completion notification to Telegram
  2. Wait for user response (with timeout)
  3. If user sends new instruction, return it to Droid
Output: 
  - JSON with decision: "block" + reason (to continue with new instruction)
  - Exit code 0 (to let Droid stop normally)
"""
import os
import sys
import json
import uuid
import logging

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import register_session, notify, wait_for_response, update_session_status
from formatters import format_session_name, format_stop_message
from config import DEFAULT_TIMEOUT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse input JSON: {e}")
        sys.exit(0)
    
    # Check if we're already in a stop hook loop
    if input_data.get("stop_hook_active", False):
        logger.info("Stop hook already active, allowing stop to prevent loop")
        sys.exit(0)
    
    # Extract session info
    session_id = input_data.get("session_id", "unknown")
    project_dir = os.environ.get("FACTORY_PROJECT_DIR", os.getcwd())
    session_name = format_session_name(project_dir, session_id)
    
    # Register/update session
    register_session(session_id, project_dir, session_name)
    update_session_status(session_id, "waiting")
    
    # Get summary if available
    summary = input_data.get("summary")
    
    # Send stop notification
    message = format_stop_message(session_name, summary)
    
    notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="stop",
        buttons=[
            {"text": "✅ Done", "callback": "done"},
            {"text": "📋 Status", "callback": "status"}
        ]
    )
    
    # Wait for user response
    request_id = str(uuid.uuid4())
    response = wait_for_response(
        session_id=session_id,
        request_id=request_id,
        timeout=DEFAULT_TIMEOUT
    )
    
    if response is None:
        logger.info("Timeout waiting for response, allowing stop")
        update_session_status(session_id, "stopped")
        sys.exit(0)
    
    response_lower = response.lower().strip()
    
    # Check for done commands
    if response_lower in ["/done", "done", "exit", "quit", "stop"]:
        logger.info("User requested done, allowing stop")
        update_session_status(session_id, "stopped")
        sys.exit(0)
    
    # User sent new instruction - block stop and continue
    update_session_status(session_id, "running")
    output = {
        "decision": "block",
        "reason": f"User instruction: {response}"
    }
    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
