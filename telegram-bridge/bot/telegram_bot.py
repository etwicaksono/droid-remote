"""
Telegram Bot Manager - Main bot class
"""
import os
import re
import logging
import asyncio
from typing import Optional, Set

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
    ContextTypes
)

from core.session_registry import SessionRegistry, session_registry
from core.message_queue import message_queue
from core.task_executor import task_executor
from core.models import Session, Notification, NotificationType, PendingRequest, SessionStatus
from .commands import (
    setup_commands,
    start_command,
    help_command,
    sessions_command,
    status_command,
    switch_command,
    setproject_command,
    setmodel_command,
    models_command,
    done_command,
    stopall_command,
    broadcast_command,
    AVAILABLE_MODELS
)
from .keyboards import (
    build_inline_keyboard,
    build_permission_keyboard,
    build_stop_keyboard
)

logger = logging.getLogger(__name__)


class TelegramBotManager:
    """
    Manages the Telegram bot instance and handles all bot-related operations.
    """
    
    def __init__(self, registry: SessionRegistry = None):
        self.registry = registry or session_registry
        self.application: Optional[Application] = None
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        
        # Configuration
        self.bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.chat_id = os.getenv("TELEGRAM_CHAT_ID")
        self.allowed_users = self._parse_allowed_users()
        
        if not self.bot_token:
            raise ValueError("TELEGRAM_BOT_TOKEN environment variable not set")
    
    def _parse_allowed_users(self) -> Set[int]:
        """Parse allowed user IDs from environment"""
        users_str = os.getenv("TELEGRAM_ALLOWED_USERS", "")
        if not users_str:
            # If not specified, allow chat_id
            if self.chat_id:
                return {int(self.chat_id)}
            return set()
        
        return {int(uid.strip()) for uid in users_str.split(",") if uid.strip()}
    
    @property
    def is_connected(self) -> bool:
        """Check if bot is connected"""
        return self.is_running and self.application is not None
    
    async def start(self):
        """Start the Telegram bot"""
        if self.is_running:
            logger.warning("Bot is already running")
            return
        
        logger.info("Starting Telegram bot...")
        
        # Build application
        self.application = (
            Application.builder()
            .token(self.bot_token)
            .build()
        )
        
        # Register handlers
        self._register_handlers()
        
        # Setup bot commands
        await setup_commands(self.application)
        
        # Initialize and start polling
        await self.application.initialize()
        await self.application.start()
        
        # Start polling in background
        self._task = asyncio.create_task(self._polling_task())
        
        self.is_running = True
        logger.info("Telegram bot started successfully")
    
    async def _polling_task(self):
        """Background task for polling"""
        try:
            await self.application.updater.start_polling(
                drop_pending_updates=True,
                allowed_updates=Update.ALL_TYPES
            )
            # Keep running until cancelled
            while self.is_running:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            logger.info("Polling task cancelled")
        except Exception as e:
            logger.error(f"Polling error: {e}")
    
    async def stop(self):
        """Stop the Telegram bot"""
        if not self.is_running:
            return
        
        logger.info("Stopping Telegram bot...")
        self.is_running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        if self.application:
            await self.application.updater.stop()
            await self.application.stop()
            await self.application.shutdown()
        
        logger.info("Telegram bot stopped")
    
    def _register_handlers(self):
        """Register all message handlers"""
        app = self.application
        
        # Add user filter
        user_filter = filters.User(user_id=list(self.allowed_users)) if self.allowed_users else filters.ALL
        
        # Command handlers
        app.add_handler(CommandHandler("start", start_command, filters=user_filter))
        app.add_handler(CommandHandler("help", help_command, filters=user_filter))
        app.add_handler(CommandHandler("sessions", sessions_command, filters=user_filter))
        app.add_handler(CommandHandler("status", status_command, filters=user_filter))
        app.add_handler(CommandHandler("switch", switch_command, filters=user_filter))
        app.add_handler(CommandHandler("setproject", setproject_command, filters=user_filter))
        app.add_handler(CommandHandler("setmodel", setmodel_command, filters=user_filter))
        app.add_handler(CommandHandler("models", models_command, filters=user_filter))
        app.add_handler(CommandHandler("done", done_command, filters=user_filter))
        app.add_handler(CommandHandler("stopall", stopall_command, filters=user_filter))
        app.add_handler(CommandHandler("broadcast", broadcast_command, filters=user_filter))
        
        # Callback query handler (inline keyboard buttons)
        app.add_handler(CallbackQueryHandler(self._handle_callback))
        
        # Text message handler (for responses)
        app.add_handler(MessageHandler(
            filters.TEXT & ~filters.COMMAND & user_filter,
            self._handle_message
        ))
        
        # Error handler
        app.add_error_handler(self._handle_error)
    
    async def _handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle inline keyboard button presses"""
        query = update.callback_query
        await query.answer()
        
        # Check user authorization
        if self.allowed_users and query.from_user.id not in self.allowed_users:
            logger.warning(f"Unauthorized callback from user {query.from_user.id}")
            return
        
        # Handle model selection callback
        if query.data.startswith("model:"):
            model_id = query.data[6:]  # Remove "model:" prefix
            if model_id == "default":
                context.user_data.pop("model", None)
                await query.edit_message_text("Model set to: Default (from Factory settings)")
            else:
                context.user_data["model"] = model_id
                # Find display name
                model_name = model_id
                for mid, mname in AVAILABLE_MODELS:
                    if mid == model_id:
                        model_name = mname
                        break
                await query.edit_message_text(f"Model set to: {model_name}\n({model_id})")
            return
        
        # Parse callback data: action:session_id[:request_id]
        parts = query.data.split(":")
        if len(parts) < 2:
            return
        
        action = parts[0]
        session_id = parts[1]
        request_id = parts[2] if len(parts) > 2 else None
        
        session = self.registry.get(session_id)
        if not session:
            await query.edit_message_text("Session no longer active")
            return
        
        # Handle different actions
        if action == "approve":
            message_queue.deliver_response(session_id, request_id, "approve")
            await query.edit_message_text(
                f"✅ Approved\n\nSession: {session.name}",
                parse_mode="Markdown"
            )
        
        elif action == "deny":
            message_queue.deliver_response(session_id, request_id, "deny")
            await query.edit_message_text(
                f"❌ Denied\n\nSession: {session.name}",
                parse_mode="Markdown"
            )
        
        elif action == "approve_all":
            message_queue.deliver_response(session_id, request_id, "approve_all")
            context.user_data["auto_approve"] = session_id
            await query.edit_message_text(
                f"✅ Approved (auto-approve enabled)\n\nSession: {session.name}",
                parse_mode="Markdown"
            )
        
        elif action == "done":
            message_queue.deliver_response(session_id, request_id, "done")
            self.registry.update_status(session_id, SessionStatus.STOPPED)
            await query.edit_message_text(
                f"✅ Session ended: {session.name}",
                parse_mode="Markdown"
            )
        
        elif action == "status":
            status = session.status
            if isinstance(status, SessionStatus):
                status = status.value
            await query.answer(f"Status: {status}", show_alert=True)
        
        elif action == "select":
            context.user_data["active_session"] = session_id
            context.user_data["project_dir"] = session.project_dir  # Also set project dir
            await query.edit_message_text(
                f"Selected session: {session.name}\n\n"
                f"Project: {session.project_dir}\n\n"
                "Send a message to interact with this session."
            )
    
    async def _handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle text messages (responses to Droid or new tasks)"""
        text = update.message.text.strip()
        user_id = update.effective_user.id
        
        # Check authorization
        if self.allowed_users and user_id not in self.allowed_users:
            logger.warning(f"Unauthorized message from user {user_id}")
            return
        
        # Check for session-prefixed message: /1 message or /name message
        session_match = re.match(r"^/(\d+|[\w-]+)\s+(.+)$", text, re.DOTALL)
        
        if session_match:
            session_ref = session_match.group(1)
            message = session_match.group(2)
            
            # Try to find session by index or name
            try:
                index = int(session_ref)
                session = self.registry.get_by_index(index)
            except ValueError:
                session = self.registry.get_by_name(session_ref)
            
            if not session:
                await update.message.reply_text(f"Session not found: {session_ref}")
                return
        else:
            # Use active session or find waiting session
            message = text
            active_id = context.user_data.get("active_session")
            
            if active_id:
                session = self.registry.get(active_id)
            else:
                # Find any waiting session
                waiting = self.registry.get_waiting_sessions()
                session = waiting[0] if waiting else None
            
            if not session:
                # No waiting session - execute as new task using droid exec
                await self._execute_new_task(update, context, message)
                return
        
        # Deliver the message to waiting session
        message_queue.deliver_response(session.id, None, message)
        self.registry.update_status(session.id, SessionStatus.RUNNING)
        
        await update.message.reply_text(f"Sent to {session.name}")
    
    async def _execute_new_task(self, update: Update, context: ContextTypes.DEFAULT_TYPE, prompt: str):
        """Execute a new task using droid exec"""
        import uuid
        
        # Get project directory from context or use default
        project_dir = context.user_data.get("project_dir")
        
        if not project_dir:
            # Try to get from last active session
            sessions = self.registry.get_all()
            if sessions:
                project_dir = sessions[-1].project_dir
            else:
                await update.message.reply_text(
                    "No project directory set. Use /setproject <path> first."
                )
                return
        
        # Get model from user settings
        model = context.user_data.get("model")
        
        # Send acknowledgment
        model_info = f"\nModel: {model}" if model else ""
        status_msg = await update.message.reply_text(
            f"Executing task in: {project_dir}{model_info}\n\nPrompt: {prompt[:100]}..."
        )
        
        try:
            # Execute the task
            task_id = str(uuid.uuid4())
            result = await task_executor.execute_task(
                task_id=task_id,
                prompt=prompt,
                project_dir=project_dir,
                autonomy_level="high",
                model=model
            )
            
            # Format result
            if result.success:
                response_text = f"Task completed ({result.duration_ms}ms)\n\n{result.result}"
            else:
                response_text = f"Task failed\n\nError: {result.error or 'Unknown error'}"
            
            # Truncate if too long for Telegram (4096 char limit)
            if len(response_text) > 4000:
                response_text = response_text[:4000] + "\n\n... (truncated)"
            
            await status_msg.edit_text(response_text)
            
        except Exception as e:
            logger.error(f"Task execution failed: {e}")
            await status_msg.edit_text(f"Task execution failed: {str(e)}")
    
    async def _handle_error(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle errors"""
        logger.error(f"Bot error: {context.error}", exc_info=context.error)
    
    async def send_notification(self, notification: Notification) -> Optional[int]:
        """Send a notification to Telegram"""
        if not self.is_connected or not self.chat_id:
            logger.warning("Cannot send notification: bot not connected or no chat_id")
            return None
        
        try:
            # Build keyboard if buttons provided
            keyboard = None
            if notification.buttons:
                # Get session for request_id
                session = self.registry.get(notification.session_id)
                request_id = session.pending_request.id if session and session.pending_request else None
                
                if notification.type == NotificationType.PERMISSION:
                    keyboard = build_permission_keyboard(notification.session_id, request_id or "")
                elif notification.type == NotificationType.STOP:
                    keyboard = build_stop_keyboard(notification.session_id, request_id or "")
                else:
                    keyboard = build_inline_keyboard(
                        notification.buttons,
                        notification.session_id,
                        request_id
                    )
            
            message = await self.application.bot.send_message(
                chat_id=self.chat_id,
                text=notification.message,
                reply_markup=keyboard
            )
            
            logger.info(f"Sent notification to Telegram: {notification.type}")
            return message.message_id
        
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
            return None
    
    async def update_message(self, message_id: int, text: str, keyboard=None):
        """Update an existing message"""
        if not self.is_connected or not self.chat_id:
            return
        
        try:
            await self.application.bot.edit_message_text(
                chat_id=self.chat_id,
                message_id=message_id,
                text=text,
                parse_mode="Markdown",
                reply_markup=keyboard
            )
        except Exception as e:
            logger.error(f"Failed to update message: {e}")
