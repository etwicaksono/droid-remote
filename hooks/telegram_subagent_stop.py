#!/usr/bin/env python3
"""
SubagentStop Hook Script

Receives: JSON via stdin with subagent completion info
Action: Notify when sub-droid tasks complete
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


def main():
    # Quick check if bridge is available (300ms timeout)
    if not is_bridge_available():
        logger.warning("Bridge not available, skipping subagent stop notification")
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
    
    # Extract subagent info
    subagent_id = input_data.get("subagent_id", "unknown")
    subagent_task = input_data.get("task", "Unknown task")
    result = input_data.get("result", "")
    success = input_data.get("success", True)
    
    # Register/update session
    register_session(session_id, project_dir, session_name)
    
    # Format message
    status_emoji = "✅" if success else "❌"
    status_text = "completed" if success else "failed"
    
    message = (
        f"{status_emoji} *[{session_name}]* Subagent {status_text}\n\n"
        f"🤖 Subagent: `{subagent_id}`\n"
        f"📋 Task: {subagent_task}"
    )
    
    if result:
        # Truncate result if too long
        result_preview = result[:500] + "..." if len(result) > 500 else result
        message += f"\n\n📝 Result:\n{result_preview}"
    
    notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="success" if success else "error"
    )
    
    logger.info(f"Subagent {subagent_id} {status_text} in session {session_name}")
    sys.exit(0)


if __name__ == "__main__":
    main()
