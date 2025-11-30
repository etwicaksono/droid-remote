"""
Telegram bot command handlers
"""
import logging
from telegram import Update, BotCommand, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from core.session_registry import session_registry
from core.message_queue import message_queue
from core.models import SessionStatus, ControlState
from .keyboards import build_session_keyboard

# Available models for droid exec
AVAILABLE_MODELS = [
    # Built-in models
    ("gpt-5.1-codex", "GPT-5.1 Codex"),
    ("gpt-5.1", "GPT-5.1"),
    ("claude-sonnet-4-5-20250929", "Claude Sonnet 4.5"),
    ("claude-opus-4-5-20251101", "Claude Opus 4.5"),
    ("claude-opus-4-1-20250805", "Claude Opus 4.1"),
    # Custom models
    ("custom:gpt-5", "GPT-5 (Custom)"),
    ("custom:claude-haiku-4-5-20251001", "Haiku 4.5 (Custom)"),
    ("custom:claude-sonnet-4-5-20250929", "Sonnet 4.5 (Custom)"),
    ("custom:deepseek-r1-0528", "DeepSeek R1 (Custom)"),
    ("custom:deepseek-v3.1", "DeepSeek V3.1 (Custom)"),
]

logger = logging.getLogger(__name__)


async def setup_commands(application) -> None:
    """Register bot commands with Telegram"""
    commands = [
        BotCommand("start", "Start the bot"),
        BotCommand("help", "Show available commands"),
        BotCommand("sessions", "List all active sessions"),
        BotCommand("status", "Check status of all sessions"),
        BotCommand("switch", "Switch active session"),
        BotCommand("setproject", "Set project directory for tasks"),
        BotCommand("setmodel", "Set model for task execution"),
        BotCommand("models", "Show available models"),
        BotCommand("handoff", "Take remote control of a session"),
        BotCommand("release", "Release control back to CLI"),
        BotCommand("queue", "Show queued messages"),
        BotCommand("done", "Signal current session to stop"),
        BotCommand("stopall", "Stop all sessions"),
        BotCommand("broadcast", "Send message to all waiting sessions"),
    ]
    await application.bot.set_my_commands(commands)


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command"""
    user = update.effective_user
    await update.message.reply_text(
        f"👋 Hello {user.first_name}!\n\n"
        "🤖 *Droid Control Bot*\n\n"
        "I'll notify you when your Factory.ai Droid sessions need attention.\n\n"
        "*Commands:*\n"
        "/sessions - List active sessions\n"
        "/status - Check session status\n"
        "/switch <name> - Switch active session\n"
        "/done - End current session\n"
        "/help - Show all commands\n\n"
        "💡 Reply to notifications to send instructions to Droid!",
        parse_mode="Markdown"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command"""
    await update.message.reply_text(
        "🤖 *Droid Control Commands*\n\n"
        "*Session Management:*\n"
        "/sessions - List all active sessions\n"
        "/status [name] - Show status\n"
        "/switch <name|number> - Set active session\n"
        "/done - Signal session to stop\n"
        "/stopall - Stop all sessions\n\n"
        "*Remote Control:*\n"
        "/handoff [name] - Take remote control\n"
        "/release [name] - Return control to CLI\n"
        "/queue [name] - Show queued messages\n\n"
        "*Communication:*\n"
        "/broadcast <msg> - Send to all waiting\n"
        "/<number> <msg> - Send to specific session\n\n"
        "*Quick Actions:*\n"
        "• Reply to notifications with text\n"
        "• Use inline buttons for approve/deny\n"
        "• Type 'approve' or 'deny' directly\n\n"
        "*Examples:*\n"
        "`/handoff` - Take control of current session\n"
        "`/release` - Return control to CLI\n"
        "`/switch backend-api`",
        parse_mode="Markdown"
    )


async def sessions_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /sessions command"""
    sessions = session_registry.get_all()
    
    if not sessions:
        await update.message.reply_text("📋 *No active sessions*", parse_mode="Markdown")
        return
    
    status_emoji = {
        "running": "🟡",
        "waiting": "🟢",
        "stopped": "🔴"
    }
    
    lines = ["📋 *Active Sessions*\n"]
    
    for i, session in enumerate(sessions, 1):
        emoji = status_emoji.get(session.status, "⚪")
        lines.append(f"{i}. {emoji} `{session.name}`")
        
        status_text = session.status.capitalize() if isinstance(session.status, str) else session.status.value.capitalize()
        lines.append(f"   └─ {status_text}")
        
        if session.pending_request:
            lines.append(f"   └─ ⚠️ Pending: {session.pending_request.type}")
    
    lines.append("\nUse /switch <name> or reply with /<number> <message>")
    
    keyboard = build_session_keyboard(sessions)
    await update.message.reply_text(
        "\n".join(lines),
        parse_mode="Markdown",
        reply_markup=keyboard
    )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /status command"""
    args = context.args
    
    if args:
        # Status for specific session
        name = " ".join(args)
        session = session_registry.get_by_name(name)
        
        if not session:
            # Try by index
            try:
                index = int(name)
                session = session_registry.get_by_index(index)
            except ValueError:
                pass
        
        if not session:
            await update.message.reply_text(f"❌ Session not found: {name}")
            return
        
        sessions = [session]
    else:
        sessions = session_registry.get_all()
    
    if not sessions:
        await update.message.reply_text("📋 *No active sessions*", parse_mode="Markdown")
        return
    
    for session in sessions:
        status_emoji = {"running": "🟡", "waiting": "🟢", "stopped": "🔴"}.get(session.status, "⚪")
        
        msg = (
            f"{status_emoji} *{session.name}*\n\n"
            f"📁 `{session.project_dir}`\n"
            f"🔄 Status: {session.status}\n"
            f"🕐 Last activity: {session.last_activity.strftime('%H:%M:%S')}"
        )
        
        if session.pending_request:
            msg += f"\n\n⚠️ *Pending Request:*\n{session.pending_request.message[:200]}"
        
        await update.message.reply_text(msg, parse_mode="Markdown")


async def switch_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /switch command"""
    args = context.args
    
    if not args:
        await update.message.reply_text(
            "Usage: /switch <session_name|number>\n"
            "Example: /switch backend-api\n"
            "Example: /switch 1"
        )
        return
    
    name = " ".join(args)
    session = session_registry.get_by_name(name)
    
    if not session:
        try:
            index = int(name)
            session = session_registry.get_by_index(index)
        except ValueError:
            pass
    
    if not session:
        await update.message.reply_text(f"❌ Session not found: {name}")
        return
    
    # Store active session in user data
    context.user_data["active_session"] = session.id
    
    await update.message.reply_text(
        f"✅ Active session: *{session.name}*\n\n"
        "All your messages will now be sent to this session.",
        parse_mode="Markdown"
    )


async def done_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /done command"""
    # Get active session
    active_session_id = context.user_data.get("active_session")
    
    if active_session_id:
        session = session_registry.get(active_session_id)
    else:
        # Find any waiting session
        waiting = session_registry.get_waiting_sessions()
        session = waiting[0] if waiting else None
    
    if not session:
        await update.message.reply_text("❌ No active session to end")
        return
    
    # Deliver "done" response
    message_queue.deliver_response(session.id, None, "done")
    session_registry.update_status(session.id, SessionStatus.STOPPED)
    
    await update.message.reply_text(
        f"✅ Sent 'done' to *{session.name}*",
        parse_mode="Markdown"
    )


async def stopall_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /stopall command"""
    sessions = session_registry.get_active_sessions()
    
    if not sessions:
        await update.message.reply_text("📋 No active sessions to stop")
        return
    
    count = 0
    for session in sessions:
        message_queue.deliver_response(session.id, None, "done")
        session_registry.update_status(session.id, SessionStatus.STOPPED)
        count += 1
    
    await update.message.reply_text(f"✅ Stopped {count} session(s)")


async def broadcast_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /broadcast command"""
    args = context.args
    
    if not args:
        await update.message.reply_text(
            "Usage: /broadcast <message>\n"
            "Sends the message to all waiting sessions."
        )
        return
    
    message = " ".join(args)
    waiting = session_registry.get_waiting_sessions()
    
    if not waiting:
        await update.message.reply_text("No waiting sessions")
        return
    
    count = 0
    for session in waiting:
        message_queue.deliver_response(session.id, None, message)
        count += 1
    
    await update.message.reply_text(f"Broadcast sent to {count} session(s):\n{message}")


async def setproject_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /setproject command"""
    import os
    args = context.args
    
    if not args:
        current = context.user_data.get("project_dir", "Not set")
        await update.message.reply_text(
            f"Current project: {current}\n\n"
            "Usage: /setproject <path>\n"
            "Example: /setproject D:/Project/my-app"
        )
        return
    
    project_dir = " ".join(args)
    
    # Validate path exists
    if not os.path.isdir(project_dir):
        await update.message.reply_text(f"Directory not found: {project_dir}")
        return
    
    # Store in user data
    context.user_data["project_dir"] = project_dir
    
    await update.message.reply_text(
        f"Project directory set to:\n{project_dir}\n\n"
        "New tasks will be executed in this directory."
    )


async def setmodel_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /setmodel command"""
    args = context.args
    
    if not args:
        current = context.user_data.get("model", "Default (from settings)")
        await update.message.reply_text(
            f"Current model: {current}\n\n"
            "Usage: /setmodel <model_id>\n"
            "Or use /models to see clickable list"
        )
        return
    
    model = args[0].strip()
    
    if model.lower() == "default":
        # Clear model to use default
        context.user_data.pop("model", None)
        await update.message.reply_text("Model reset to default (from Factory settings)")
    else:
        context.user_data["model"] = model
        await update.message.reply_text(f"Model set to: {model}")


async def models_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /models command - show available models with clickable buttons"""
    current = context.user_data.get("model", None)
    current_display = current if current else "Default"
    
    # Build inline keyboard with model buttons (2 per row)
    keyboard = []
    row = []
    for model_id, model_name in AVAILABLE_MODELS:
        # Mark current model with checkmark
        display = f"[x] {model_name}" if model_id == current else model_name
        row.append(InlineKeyboardButton(display, callback_data=f"model:{model_id}"))
        if len(row) == 2:
            keyboard.append(row)
            row = []
    
    # Add remaining button if odd number
    if row:
        keyboard.append(row)
    
    # Add "Default" option
    default_display = "[x] Default" if current is None else "Default"
    keyboard.append([InlineKeyboardButton(default_display, callback_data="model:default")])
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        f"Current model: {current_display}\n\nSelect a model:",
        reply_markup=reply_markup
    )


# Control State Commands

async def handoff_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /handoff command - take remote control of a session"""
    args = context.args
    
    # Determine which session to handoff
    if args:
        name = " ".join(args)
        session = session_registry.get_by_name(name)
        if not session:
            try:
                index = int(name)
                session = session_registry.get_by_index(index)
            except ValueError:
                pass
    else:
        # Use active session or first waiting session
        active_session_id = context.user_data.get("active_session")
        if active_session_id:
            session = session_registry.get(active_session_id)
        else:
            waiting = session_registry.get_waiting_sessions()
            session = waiting[0] if waiting else None
    
    if not session:
        await update.message.reply_text(
            "No session to handoff.\n"
            "Usage: /handoff [session_name|number]"
        )
        return
    
    # Check if already under remote control
    if session.control_state == ControlState.REMOTE_ACTIVE:
        await update.message.reply_text(
            f"Session *{session.name}* is already under remote control.",
            parse_mode="Markdown"
        )
        return
    
    # Perform handoff
    result = session_registry.handoff_to_remote(session.id)
    if not result:
        await update.message.reply_text(
            f"Cannot handoff *{session.name}* - not in CLI state.\n"
            f"Current state: {session.control_state}",
            parse_mode="Markdown"
        )
        return
    
    # Set as active session
    context.user_data["active_session"] = session.id
    
    # Show queue count if any
    queue_count = session_registry.get_queue_count(session.id)
    queue_msg = f"\n{queue_count} message(s) queued." if queue_count > 0 else ""
    
    await update.message.reply_text(
        f"You now have remote control of *{session.name}*\n"
        f"Your messages will be executed as tasks.{queue_msg}\n\n"
        "Use /release to return control to CLI.",
        parse_mode="Markdown"
    )


async def release_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /release command - release control back to CLI"""
    args = context.args
    
    # Determine which session to release
    if args:
        name = " ".join(args)
        session = session_registry.get_by_name(name)
        if not session:
            try:
                index = int(name)
                session = session_registry.get_by_index(index)
            except ValueError:
                pass
    else:
        # Use active session or first remote-controlled session
        active_session_id = context.user_data.get("active_session")
        if active_session_id:
            session = session_registry.get(active_session_id)
        else:
            remote = session_registry.get_remote_controlled_sessions()
            session = remote[0] if remote else None
    
    if not session:
        await update.message.reply_text(
            "No session to release.\n"
            "Usage: /release [session_name|number]"
        )
        return
    
    # Check if under remote control
    if session.control_state != ControlState.REMOTE_ACTIVE:
        await update.message.reply_text(
            f"Session *{session.name}* is not under remote control.\n"
            f"Current state: {session.control_state}",
            parse_mode="Markdown"
        )
        return
    
    # Perform release
    result = session_registry.release_to_cli(session.id)
    if not result:
        await update.message.reply_text(
            f"Cannot release *{session.name}*.",
            parse_mode="Markdown"
        )
        return
    
    # Clear active session
    if context.user_data.get("active_session") == session.id:
        context.user_data.pop("active_session", None)
    
    await update.message.reply_text(
        f"Released control of *{session.name}* back to CLI.\n\n"
        "Run `droid --continue` in terminal to resume.",
        parse_mode="Markdown"
    )


async def queue_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /queue command - show queued messages"""
    args = context.args
    
    # Determine which session's queue to show
    if args:
        name = " ".join(args)
        session = session_registry.get_by_name(name)
        if not session:
            try:
                index = int(name)
                session = session_registry.get_by_index(index)
            except ValueError:
                pass
    else:
        active_session_id = context.user_data.get("active_session")
        if active_session_id:
            session = session_registry.get(active_session_id)
        else:
            sessions = session_registry.get_all()
            session = sessions[0] if sessions else None
    
    if not session:
        await update.message.reply_text("No session selected.")
        return
    
    messages = session_registry.get_queued_messages(session.id)
    
    if not messages:
        await update.message.reply_text(
            f"No queued messages for *{session.name}*",
            parse_mode="Markdown"
        )
        return
    
    lines = [f"Queued messages for *{session.name}*:\n"]
    for i, msg in enumerate(messages[:10], 1):  # Limit to 10
        content = msg['content'][:50] + "..." if len(msg['content']) > 50 else msg['content']
        lines.append(f"{i}. {content}")
    
    if len(messages) > 10:
        lines.append(f"\n... and {len(messages) - 10} more")
    
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
