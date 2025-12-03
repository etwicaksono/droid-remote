#!/usr/bin/env python3
"""
PreToolUse Hook Script

Receives: JSON via stdin with tool_name and tool_input
Action:
  1. Check allowlist - if allowed, return immediately
  2. Send approval request to Web UI with tool details
  3. Wait for user response (approve/deny/always_allow)
Output:
  - JSON with permissionDecision: "allow" or "deny"
"""
import os
import sys
import json
import uuid
import logging
import urllib.request
import urllib.parse

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import register_session, notify, wait_for_response, update_session_status, is_bridge_available
from formatters import format_session_name, format_permission_request
from config import PERMISSION_TIMEOUT, BRIDGE_URL, BRIDGE_SECRET

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def check_allowlist(tool_name: str, tool_input: dict) -> bool:
    """Check if tool is in allowlist (quick HTTP check)"""
    try:
        params = urllib.parse.urlencode({
            "tool_name": tool_name,
            "tool_input": json.dumps(tool_input)
        })
        url = f"{BRIDGE_URL}/allowlist/check?{params}"
        req = urllib.request.Request(url, method="GET")
        req.add_header("X-Bridge-Secret", BRIDGE_SECRET)
        with urllib.request.urlopen(req, timeout=0.5) as resp:
            data = json.loads(resp.read().decode())
            return data.get("allowed", False)
    except Exception:
        return False


def add_to_allowlist(tool_name: str, tool_input: dict) -> bool:
    """Add tool to allowlist"""
    try:
        # Determine pattern based on tool type
        if tool_name == "Execute":
            command = tool_input.get("command", "")
            # Use first word + wildcard (e.g., "npm *")
            parts = command.split()
            pattern = f"{parts[0]} *" if parts else "*"
        elif tool_name in ("Read", "Edit", "Create", "MultiEdit"):
            pattern = "*"  # Allow all file operations
        else:
            pattern = "*"  # Allow all for this tool
        
        params = urllib.parse.urlencode({
            "tool_name": tool_name,
            "pattern": pattern,
            "description": f"Auto-added via Always Allow"
        })
        url = f"{BRIDGE_URL}/allowlist?{params}"
        req = urllib.request.Request(url, method="POST")
        req.add_header("X-Bridge-Secret", BRIDGE_SECRET)
        with urllib.request.urlopen(req, timeout=1) as resp:
            data = json.loads(resp.read().decode())
            return data.get("success", False)
    except Exception as e:
        logger.error(f"Failed to add to allowlist: {e}")
        return False


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
        print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
        sys.exit(0)
    
    try:
        input_data = json.load(sys.stdin)
        debug_log(f"Input data: {json.dumps(input_data, indent=2)}")
    except json.JSONDecodeError as e:
        debug_log(f"Failed to parse input JSON: {e}")
        logger.error(f"Failed to parse input JSON: {e}")
        # Fail open - allow tool to proceed
        print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
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
    tool_name = input_data.get("tool_name", "Unknown")
    tool_input = input_data.get("tool_input", {})
    
    debug_log(f"Session ID: {session_id}")
    debug_log(f"Tool: {tool_name}")
    
    # Check allowlist first - if allowed, return immediately
    if check_allowlist(tool_name, tool_input):
        debug_log(f"Tool {tool_name} allowed by allowlist")
        print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
        sys.exit(0)
    
    debug_log(f"Tool {tool_name} not in allowlist, requesting permission")
    
    # Register/update session
    register_session(session_id, project_dir, session_name)
    update_session_status(session_id, "waiting")
    
    # Format permission request message
    message = format_permission_request(session_name, tool_name, tool_input)
    
    # Send approval request with "Always Allow" button
    debug_log(f"Calling notify...")
    notify_result = notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="permission",
        buttons=[
            {"text": "✅ Approve", "callback": "approve"},
            {"text": "❌ Deny", "callback": "deny"},
            {"text": "✅ Always Allow", "callback": "always_allow"}
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
        
        if response_lower == "always_allow":
            # Add to allowlist and approve
            add_to_allowlist(tool_name, tool_input)
            output = {"hookSpecificOutput": {"permissionDecision": "allow"}}
            logger.info(f"Tool {tool_name} added to allowlist and approved")
        elif response_lower in ["approve", "yes", "y", "ok", "allow"]:
            output = {"hookSpecificOutput": {"permissionDecision": "allow"}}
            logger.info(f"Tool {tool_name} approved by user")
        else:
            output = {
                "hookSpecificOutput": {
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"User denied: {response}"
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
