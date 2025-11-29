"""
Telegram bot command handlers
"""
import logging
from telegram import Update, BotCommand
from telegram.ext import ContextTypes

from core.session_registry import session_registry
from core.message_queue import message_queue
from core.models import SessionStatus
from .keyboards import build_session_keyboard

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
        "*Communication:*\n"
        "/broadcast <msg> - Send to all waiting\n"
        "/<number> <msg> - Send to specific session\n\n"
        "*Quick Actions:*\n"
        "• Reply to notifications with text\n"
        "• Use inline buttons for approve/deny\n"
        "• Type 'approve' or 'deny' directly\n\n"
        "*Examples:*\n"
        "`/1 continue with tests`\n"
        "`/switch backend-api`\n"
        "`/broadcast fix all linting errors`",
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
