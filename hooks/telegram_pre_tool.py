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

from bridge_client import register_session, notify, wait_for_response, update_session_status, is_bridge_available
from formatters import format_session_name, format_permission_request
from config import PERMISSION_TIMEOUT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    # Log to file for debugging
    import tempfile
    log_file = os.path.join(tempfile.gettempdir(), "pretool_debug.log")
    
    def debug_log(msg):
        with open(log_file, "a") as f:
            f.write(f"{msg}\n")
    
    debug_log(f"\n=== PreToolUse Hook Started ===")
    
    # Quick check if bridge is available (300ms timeout)
    if not is_bridge_available():
        debug_log("Bridge not available, allowing tool (fail open)")
        print(json.dumps({"permissionDecision": "allow"}))
        sys.exit(0)
    
    debug_log(f"Environment variables:")
    for key, value in os.environ.items():
        if 'FACTORY' in key or 'SESSION' in key or 'DROID' in key:
            debug_log(f"  {key}={value}")
    
    try:
        input_data = json.load(sys.stdin)
        debug_log(f"Input data: {json.dumps(input_data, indent=2)}")
    except json.JSONDecodeError as e:
        debug_log(f"Failed to parse input JSON: {e}")
        logger.error(f"Failed to parse input JSON: {e}")
        # Fail open - allow tool to proceed
        print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
        sys.exit(0)
    
    # Extract session info - try multiple possible field names
    session_id = (
        input_data.get("session_id") or 
        input_data.get("sessionId") or 
        os.environ.get("FACTORY_SESSION_ID") or
        os.environ.get("SESSION_ID") or
        "unknown"
    )
    project_dir = os.environ.get("FACTORY_PROJECT_DIR", os.getcwd())
    session_name = format_session_name(project_dir, session_id)
    tool_name = input_data.get("tool_name") or input_data.get("toolName", "Unknown")
    tool_input = input_data.get("tool_input") or input_data.get("toolInput", {})
    
    debug_log(f"Session ID: {session_id}")
    debug_log(f"Tool: {tool_name}")
    debug_log(f"Tool input keys: {list(tool_input.keys()) if isinstance(tool_input, dict) else 'not a dict'}")
    
    # Register/update session
    register_session(session_id, project_dir, session_name)
    update_session_status(session_id, "waiting")
    
    # Format permission request message
    message = format_permission_request(session_name, tool_name, tool_input)
    
    # Send approval request and get request_id
    debug_log(f"Calling notify...")
    notify_result = notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="permission",
        buttons=[
            {"text": "✅ Approve", "callback": "approve"},
            {"text": "❌ Deny", "callback": "deny"},
            {"text": "✅ Approve All", "callback": "approve_all"}
        ],
        tool_name=tool_name,
        tool_input=tool_input
    )
    debug_log(f"Notify result: {notify_result}")
    
    # Get request_id from notify response
    request_id = notify_result.get("request_id", str(uuid.uuid4()))
    debug_log(f"Request ID: {request_id}")
    debug_log(f"Waiting for response...")
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
