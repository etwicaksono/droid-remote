"""
Formatters - Format Droid data for Telegram messages
"""
import json
from typing import Any, Dict, Optional


def escape_markdown(text: str) -> str:
    """Escape special characters for Telegram MarkdownV2"""
    special_chars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']
    for char in special_chars:
        text = text.replace(char, f'\\{char}')
    return text


def format_tool_input(tool_name: str, tool_input: Dict[str, Any]) -> str:
    """Format tool input for readable Telegram message"""
    if tool_name == "Bash" or tool_name == "Execute":
        command = tool_input.get("command", "N/A")
        return f"```bash\n{command}\n```"
    
    elif tool_name in ["Write", "Create"]:
        path = tool_input.get("file_path") or tool_input.get("path", "N/A")
        content = tool_input.get("content", "")
        preview = content[:200] + "..." if len(content) > 200 else content
        return f"File: `{path}`\n```\n{preview}\n```"
    
    elif tool_name == "Edit" or tool_name == "MultiEdit":
        path = tool_input.get("file_path") or tool_input.get("path", "N/A")
        old_str = tool_input.get("old_str", "")[:100]
        new_str = tool_input.get("new_str", "")[:100]
        return f"File: `{path}`\n- Old: `{old_str}`\n+ New: `{new_str}`"
    
    elif tool_name == "Read":
        path = tool_input.get("file_path") or tool_input.get("path", "N/A")
        return f"File: `{path}`"
    
    elif tool_name == "Grep":
        pattern = tool_input.get("pattern", "N/A")
        path = tool_input.get("path", ".")
        return f"Pattern: `{pattern}`\nPath: `{path}`"
    
    elif tool_name == "Glob":
        patterns = tool_input.get("patterns", [])
        return f"Patterns: `{', '.join(patterns)}`"
    
    elif tool_name == "LS":
        path = tool_input.get("directory_path", ".")
        return f"Directory: `{path}`"
    
    else:
        # Generic JSON format for unknown tools
        formatted = json.dumps(tool_input, indent=2, ensure_ascii=False)
        if len(formatted) > 500:
            formatted = formatted[:500] + "\n..."
        return f"```json\n{formatted}\n```"


def format_session_name(project_dir: str, session_id: Optional[str] = None) -> str:
    """Generate a friendly session name from project directory"""
    import os
    
    # Get the last directory name
    name = os.path.basename(os.path.normpath(project_dir))
    
    # If empty (root directory), use the drive or a default
    if not name:
        name = project_dir.replace("\\", "/").split("/")[-1] or "root"
    
    return name


def format_notification_message(
    session_name: str,
    message: str,
    notification_type: str = "info"
) -> str:
    """Format notification message with session context"""
    type_emoji = {
        "info": "ℹ️",
        "warning": "⚠️",
        "error": "❌",
        "success": "✅",
        "permission": "🔐",
        "stop": "⏹️",
        "start": "▶️",
    }
    
    emoji = type_emoji.get(notification_type, "🔔")
    return f"{emoji} *[{session_name}]*\n\n{message}"


def format_permission_request(
    session_name: str,
    tool_name: str,
    tool_input: Dict[str, Any]
) -> str:
    """Format permission request message"""
    formatted_input = format_tool_input(tool_name, tool_input)
    
    return (
        f"🔐 *[{session_name}] Permission Required*\n\n"
        f"Droid wants to execute:\n"
        f"Tool: `{tool_name}`\n\n"
        f"{formatted_input}"
    )


def format_stop_message(
    session_name: str,
    summary: Optional[str] = None
) -> str:
    """Format stop/completion message"""
    base_msg = f"✅ *[{session_name}]* Droid has stopped."
    
    if summary:
        base_msg += f"\n\n{summary}"
    
    base_msg += "\n\nReply with your next instruction or /done to end."
    return base_msg


def format_session_list(sessions: list) -> str:
    """Format session list for /sessions command"""
    if not sessions:
        return "📋 *No active sessions*"
    
    status_emoji = {
        "running": "🟡",
        "waiting": "🟢",
        "stopped": "🔴",
    }
    
    lines = ["📋 *Active Sessions*\n"]
    
    for i, session in enumerate(sessions, 1):
        emoji = status_emoji.get(session.get("status", "unknown"), "⚪")
        name = session.get("name", "unknown")
        status = session.get("status", "unknown")
        
        lines.append(f"{i}. {emoji} `{name}`")
        lines.append(f"   └─ {status.capitalize()}")
    
    lines.append("\nUse /switch <name> or reply with /<number> <message>")
    return "\n".join(lines)
