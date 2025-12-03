#!/usr/bin/env python3
"""
PostToolUse Hook Script (Optional)

Receives: JSON via stdin with tool execution results
Action: Report tool execution results (for monitoring/logging)
Output: Exit code 0
"""
import os
import sys
import json
import logging

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import register_session, notify, is_bridge_available
from formatters import format_session_name

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Tools to report on (configure as needed)
REPORT_TOOLS = {"Bash", "Execute", "Write", "Create", "Edit", "MultiEdit"}
REPORT_ERRORS_ONLY = True  # Only report failed executions


def main():
    # Quick check if bridge is available (300ms timeout)
    if not is_bridge_available():
        logger.warning("Bridge not available, skipping post tool notification")
        sys.exit(0)
    
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse input JSON: {e}")
        sys.exit(0)
    
    # Extract info (Factory sends camelCase: sessionId)
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
    tool_output = input_data.get("tool_output", {})
    success = input_data.get("success", True)
    error = input_data.get("error")
    
    # Skip if not a tool we want to report on
    if tool_name not in REPORT_TOOLS:
        sys.exit(0)
    
    # Skip successful executions if configured
    if REPORT_ERRORS_ONLY and success:
        sys.exit(0)
    
    # Register session
    register_session(session_id, project_dir, session_name)
    
    # Format message
    if success:
        status_emoji = "✅"
        status_text = "succeeded"
    else:
        status_emoji = "❌"
        status_text = "failed"
    
    message = f"{status_emoji} *[{session_name}]* Tool {status_text}\n\nTool: `{tool_name}`"
    
    if error:
        message += f"\n\n❌ Error:\n```\n{error[:500]}\n```"
    
    notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="success" if success else "error"
    )
    
    sys.exit(0)


if __name__ == "__main__":
    main()
