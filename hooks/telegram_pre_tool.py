#!/usr/bin/env python3
"""
PreToolUse Hook Script

Receives: JSON via stdin with tool_name and tool_input
Action:
  1. Send approval request to Telegram with tool details
  2. Wait for user response (approve/deny)
Output:
  - JSON with permissionDecision: "allow" or "deny"
"""
import os
import sys
import json
import uuid
import logging

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import register_session, notify, wait_for_response, update_session_status
from formatters import format_session_name, format_permission_request
from config import PERMISSION_TIMEOUT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse input JSON: {e}")
        # Fail open - allow tool to proceed
        print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
        sys.exit(0)
    
    # Extract session info
    session_id = input_data.get("session_id", "unknown")
    project_dir = os.environ.get("FACTORY_PROJECT_DIR", os.getcwd())
    session_name = format_session_name(project_dir, session_id)
    tool_name = input_data.get("tool_name", "Unknown")
    tool_input = input_data.get("tool_input", {})
    
    # Register/update session
    register_session(session_id, project_dir, session_name)
    update_session_status(session_id, "waiting")
    
    # Format permission request message
    message = format_permission_request(session_name, tool_name, tool_input)
    
    # Send approval request
    notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="permission",
        buttons=[
            {"text": "✅ Approve", "callback": "approve"},
            {"text": "❌ Deny", "callback": "deny"},
            {"text": "✅ Approve All", "callback": "approve_all"}
        ]
    )
    
    # Wait for response
    request_id = str(uuid.uuid4())
    response = wait_for_response(
        session_id=session_id,
        request_id=request_id,
        timeout=PERMISSION_TIMEOUT
    )
    
    # Update status back to running
    update_session_status(session_id, "running")
    
    # Process response
    if response:
        response_lower = response.lower().strip()
        
        if response_lower in ["approve", "yes", "y", "ok", "allow", "approve_all"]:
            output = {"hookSpecificOutput": {"permissionDecision": "allow"}}
            logger.info(f"Tool {tool_name} approved by user")
        else:
            output = {
                "hookSpecificOutput": {
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"User denied via Telegram: {response}"
                }
            }
            logger.info(f"Tool {tool_name} denied by user: {response}")
    else:
        # Timeout - deny by default for safety
        output = {
            "hookSpecificOutput": {
                "permissionDecision": "deny",
                "permissionDecisionReason": "Permission request timed out"
            }
        }
        logger.warning(f"Tool {tool_name} denied due to timeout")
    
    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
