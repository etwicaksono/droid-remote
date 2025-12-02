#!/usr/bin/env python3
"""
Stop Hook Script

Receives: JSON via stdin with session/transcript info
Action: Save chat history to database and send notification to Telegram
Output: Exit code 0 to allow Droid to stop

For further instructions, use the Web UI.
"""
import os
import sys
import json
import logging

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import register_session, notify, update_session_status, add_chat_message, is_bridge_available
from formatters import format_session_name
from config import WEB_UI_URL, TELEGRAM_TASK_RESULT_MAX_LENGTH

# Log to a file to avoid corrupting JSON output
log_file = os.path.join(os.path.dirname(__file__), "stop_hook.log")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename=log_file,
    filemode='a'
)
logger = logging.getLogger(__name__)


def format_telegram_notification(
    session_name: str,
    summary: str = None,
    prompt: str = None,
    session_id: str = None,
    web_ui_url: str = None
) -> str:
    """Format notification message (same style as Web UI)"""
    lines = [
        "✅ *Task Completed*",
        f"📁 Project: `{session_name}`",
    ]
    
    # Add prompt if available
    if prompt:
        truncated_prompt = prompt[:100] + '...' if len(prompt) > 100 else prompt
        # Escape markdown
        truncated_prompt = truncated_prompt.replace("_", "\\_").replace("*", "\\*").replace("`", "\\`")
        lines.append(f"💬 Prompt: _{truncated_prompt}_")
    
    # Add result/summary if available
    if summary:
        result_text = summary
        if TELEGRAM_TASK_RESULT_MAX_LENGTH > 0 and len(result_text) > TELEGRAM_TASK_RESULT_MAX_LENGTH:
            result_text = result_text[:TELEGRAM_TASK_RESULT_MAX_LENGTH] + "..."
        # Escape markdown
        result_text = result_text.replace("_", "\\_").replace("*", "\\*").replace("`", "\\`")
        lines.append("")
        lines.append("📝 *Result:*")
        lines.append(result_text)
    
    # Add Web UI link
    if session_id and web_ui_url:
        lines.append("")
        lines.append(f"🔗 [Open in Web UI]({web_ui_url}/session/{session_id})")
    
    return "\n".join(lines)


# Track last prompt (stored in file for persistence across hook calls)
PROMPT_FILE = os.path.join(os.path.dirname(__file__), ".last_prompt")

def save_last_prompt(session_id: str, prompt: str):
    """Save the last prompt for a session"""
    try:
        data = {}
        if os.path.exists(PROMPT_FILE):
            with open(PROMPT_FILE, 'r') as f:
                data = json.load(f)
        data[session_id] = prompt
        with open(PROMPT_FILE, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        logger.error(f"Failed to save prompt: {e}")

def get_last_prompt(session_id: str) -> str:
    """Get the last prompt for a session"""
    try:
        if os.path.exists(PROMPT_FILE):
            with open(PROMPT_FILE, 'r') as f:
                data = json.load(f)
                return data.get(session_id)
    except Exception as e:
        logger.error(f"Failed to get prompt: {e}")
    return None

def clear_last_prompt(session_id: str):
    """Clear the last prompt for a session"""
    try:
        if os.path.exists(PROMPT_FILE):
            with open(PROMPT_FILE, 'r') as f:
                data = json.load(f)
            if session_id in data:
                del data[session_id]
                with open(PROMPT_FILE, 'w') as f:
                    json.dump(data, f)
    except Exception as e:
        logger.error(f"Failed to clear prompt: {e}")


def main():
    # Skip if running via droid exec (task executor handles responses)
    if os.environ.get("DROID_EXEC_MODE") == "1":
        logger.info("Running in exec mode, skipping stop hook")
        sys.exit(0)
    
    # Quick check if bridge is available (300ms timeout)
    if not is_bridge_available():
        logger.warning("Bridge not available, skipping stop hook")
        sys.exit(0)
    
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse input JSON: {e}")
        sys.exit(0)
    
    # Check if we're already in a stop hook loop (Factory sends camelCase)
    if input_data.get("stopHookActive", False) or input_data.get("stop_hook_active", False):
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
    
    # Read transcript to get last assistant message
    transcript_path = input_data.get("transcriptPath") or input_data.get("transcript_path")
    summary = None
    if transcript_path:
        try:
            if os.path.exists(transcript_path):
                with open(transcript_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                # Debug: log last few entries to understand structure
                logger.info(f"Transcript has {len(lines)} lines")
                for i, line in enumerate(lines[-5:]):
                    try:
                        entry = json.loads(line.strip())
                        msg = entry.get('message', {})
                        msg_role = msg.get('role') if isinstance(msg, dict) else None
                        logger.info(f"Entry {i}: type={entry.get('type')}, role={msg_role}, msg_keys={list(msg.keys()) if isinstance(msg, dict) else 'not dict'}")
                    except:
                        pass
                
                # Read from end to find last assistant message
                for line in reversed(lines):
                    try:
                        entry = json.loads(line.strip())
                        message = entry.get("message", {})
                        
                        # Check for assistant role (Factory uses role field inside message)
                        is_assistant = (
                            entry.get("type") == "assistant" or
                            (isinstance(message, dict) and message.get("role") == "assistant")
                        )
                        
                        if is_assistant:
                            # Get the message content
                            if isinstance(message, dict):
                                content = message.get("content", [])
                                if isinstance(content, list):
                                    # Extract text from content blocks
                                    texts = []
                                    for block in content:
                                        if isinstance(block, dict) and block.get("type") == "text":
                                            texts.append(block.get("text", ""))
                                    summary = "\n".join(texts)
                                elif isinstance(content, str):
                                    summary = content
                            elif isinstance(message, str):
                                summary = message
                            if summary:
                                logger.info(f"Found assistant message in transcript ({len(summary)} chars)")
                                break
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.error(f"Failed to read transcript: {e}")
    
    # Get the prompt that triggered this task (from previous hook call or transcript)
    last_prompt = get_last_prompt(session_id)
    prompt_already_saved = last_prompt is not None  # If from get_last_prompt, UserPromptSubmit already saved it
    
    # If no prompt saved, try to get from transcript
    if not last_prompt and transcript_path:
        try:
            if os.path.exists(transcript_path):
                with open(transcript_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                # Find last user message before the assistant message
                for line in reversed(lines):
                    try:
                        entry = json.loads(line.strip())
                        message = entry.get("message", {})
                        
                        # Check for user/human role
                        is_user = (
                            entry.get("type") == "human" or
                            (isinstance(message, dict) and message.get("role") in ("user", "human"))
                        )
                        
                        if is_user:
                            if isinstance(message, dict):
                                content = message.get("content", "")
                                if isinstance(content, str):
                                    last_prompt = content
                                elif isinstance(content, list):
                                    texts = []
                                    for block in content:
                                        if isinstance(block, dict) and block.get("type") == "text":
                                            texts.append(block.get("text", ""))
                                    last_prompt = "\n".join(texts)
                            elif isinstance(message, str):
                                last_prompt = message
                            if last_prompt:
                                logger.info(f"Found user message in transcript ({len(last_prompt)} chars)")
                                break
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.error(f"Failed to read user prompt from transcript: {e}")
    
    # Save user prompt to database (only if from transcript, not already saved by UserPromptSubmit)
    if last_prompt and not prompt_already_saved:
        try:
            add_chat_message(
                session_id=session_id,
                msg_type='user',
                content=last_prompt,
                source='cli'
            )
            logger.info(f"Saved user message to database ({len(last_prompt)} chars)")
        except Exception as e:
            logger.error(f"Failed to save user message: {e}")
    elif prompt_already_saved:
        logger.info("User message already saved by UserPromptSubmit hook")
    
    # Save summary (assistant response) to database
    if summary:
        try:
            add_chat_message(
                session_id=session_id,
                msg_type='assistant',
                content=summary,
                status='success',
                source='cli'
            )
            logger.info(f"Saved assistant message to database ({len(summary)} chars)")
        except Exception as e:
            logger.error(f"Failed to save assistant message: {e}")
    
    # Send notification (same format as Web UI)
    try:
        message = format_telegram_notification(
            session_name=session_name,
            summary=summary,
            prompt=last_prompt,
            session_id=session_id,
            web_ui_url=WEB_UI_URL
        )
        logger.info("Sending notification...")
        notify(
            session_id=session_id,
            session_name=session_name,
            message=message,
            notification_type="info",
            buttons=[]
        )
        logger.info("Notification sent")
        
        # Clear the last prompt after using it
        clear_last_prompt(session_id)
        
        # Update session status
        logger.info("Updating session status...")
        update_session_status(session_id, "waiting")
        logger.info("Session status updated")
    except Exception as e:
        logger.error(f"Error in notification/status update: {e}")
    finally:
        # Always exit - don't block CLI (use os._exit for immediate termination)
        logger.info("Exiting hook")
        os._exit(0)


if __name__ == "__main__":
    main()
