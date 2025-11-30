#!/usr/bin/env python3
"""
Stop Hook Script

Receives: JSON via stdin with session/transcript info
Action: Wait for user input from Telegram, or allow stop after timeout
Output: 
  - Exit code 0: Allow Droid to stop
  - Exit code 2 + stderr: Feed instruction to Droid
"""
import os
import sys
import json
import logging
import uuid

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import register_session, notify, update_session_status, wait_for_response
from formatters import format_session_name, format_stop_message

# Log to stdout, not stderr (stderr is used for instruction output)
logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger(__name__)

WAIT_TIMEOUT = 300  # 5 minutes


def main():
    # Skip if running via droid exec (task executor handles responses)
    if os.environ.get("DROID_EXEC_MODE") == "1":
        logger.info("Running in exec mode, skipping stop hook")
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
    
    # Extract session info
    session_id = (
        input_data.get("session_id") or 
        input_data.get("sessionId") or 
        input_data.get("id") or 
        "unknown"
    )
    project_dir = os.environ.get("FACTORY_PROJECT_DIR", os.getcwd())
    session_name = format_session_name(project_dir, session_id)
    
    # Register session and set status to waiting
    register_session(session_id, project_dir, session_name)
    update_session_status(session_id, "waiting")
    
    # Get summary if available
    summary = input_data.get("summary")
    
    # Send stop notification asking for input
    message = format_stop_message(session_name, summary)
    notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="stop",
        buttons=[]
    )
    
    # Generate request ID and wait for response
    request_id = str(uuid.uuid4())
    logger.info(f"Waiting for response (session={session_id}, request={request_id})")
    
    response = wait_for_response(session_id, request_id, timeout=WAIT_TIMEOUT)
    
    if response:
        # User sent instruction - feed it to Droid
        logger.info(f"Received instruction: {response[:100]}...")
        update_session_status(session_id, "running")
        
        # Write to stderr and exit with code 2 to feed instruction to Droid
        sys.stderr.write(response)
        sys.exit(2)
    else:
        # Timeout or /done - allow stop
        logger.info("No response received, allowing stop")
        update_session_status(session_id, "stopped")
        sys.exit(0)


if __name__ == "__main__":
    main()
