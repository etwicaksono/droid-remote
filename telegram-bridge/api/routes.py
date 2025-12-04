"""
FastAPI REST API routes for the bridge server
"""
import os
import sys
import uuid
import asyncio
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request, Depends, Header, UploadFile, File, Form

# Get config from environment
TELEGRAM_TASK_RESULT_MAX_LENGTH = int(os.getenv("TELEGRAM_TASK_RESULT_MAX_LENGTH", "0"))
WEB_UI_URL = os.getenv("WEB_UI_URL", "http://localhost:3000")

from core.session_registry import session_registry
from core.message_queue import message_queue
from core.task_executor import task_executor
from core.repositories import get_permission_repo, get_task_repo, get_event_repo, get_chat_repo, get_settings_repo, get_session_repo
from core.models import (
    Session,
    SessionStatus,
    PendingRequest,
    NotificationType,
    RegisterSessionRequest,
    UpdateSessionRequest,
    NotifyRequest,
    WaitRequest,
    WaitResponse,
    RespondRequest,
    HealthResponse,
    Button,
    TaskExecuteRequest,
    TaskResponse
)
from api.auth import (
    create_token,
    verify_token,
    verify_credentials,
    verify_api_key,
    require_auth,
    get_bridge_secret,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Track CLI thinking state per session (in-memory, ephemeral)
cli_thinking_state: dict[str, bool] = {}


def verify_secret(x_bridge_secret: Optional[str] = Header(None)):
    """Verify the bridge secret header"""
    secret = get_bridge_secret()
    if secret and x_bridge_secret != secret:
        raise HTTPException(status_code=401, detail="Invalid bridge secret")
    return True


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request):
    """Health check endpoint"""
    bot_manager = request.app.state.bot_manager()
    return HealthResponse(
        status="healthy",
        active_sessions=len(session_registry.get_active_sessions()),
        bot_connected=bot_manager.is_connected if bot_manager else False
    )


@router.get("/config/project-dirs")
async def get_project_dirs():
    """Get directory browser setting and predefined project directories"""
    browser_enabled = os.getenv("ENABLE_DIRECTORY_BROWSER", "true").lower() == "true"
    project_dirs_str = os.getenv("PROJECT_DIRS", "")
    
    # Split by pipe delimiter, filter empty strings
    project_dirs = [d.strip() for d in project_dirs_str.split("|") if d.strip()]
    
    return {
        "browser_enabled": browser_enabled,
        "project_dirs": project_dirs
    }


# ============ Auth Endpoints ============

@router.post("/auth/login")
async def login(request: Request):
    """Login with username and password, returns JWT token"""
    try:
        body = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    username = body.get("username", "")
    password = body.get("password", "")
    
    if not verify_credentials(username, password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_token(username)
    return {
        "success": True,
        "token": token,
        "username": username
    }


@router.get("/auth/verify")
async def verify_auth(request: Request, user: str = Depends(require_auth)):
    """Verify if the current token is valid"""
    return {
        "success": True,
        "authenticated": True,
        "username": user
    }


@router.post("/auth/refresh")
async def refresh_token(request: Request, user: str = Depends(require_auth)):
    """Refresh the JWT token"""
    token = create_token(user)
    return {
        "success": True,
        "token": token,
        "username": user
    }


@router.post("/sessions/register", dependencies=[Depends(verify_secret)])
async def register_session(data: RegisterSessionRequest, request: Request):
    """Register or update a Droid session"""
    session = session_registry.register(
        session_id=data.session_id,
        project_dir=data.project_dir,
        name=data.session_name
    )
    
    # Emit sessions_update
    sio = getattr(request.app.state, "sio", None)
    if sio:
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
    
    return {"success": True, "session": session.model_dump(mode='json')}


@router.get("/sessions")
async def get_sessions():
    """Get all sessions with queue counts"""
    sessions = session_registry.get_all()
    result = []
    for session in sessions:
        data = session.model_dump(mode='json')
        data['queue_count'] = session_registry.get_queue_count(session.id)
        result.append(data)
    return result


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get a single session by ID"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    result = session.model_dump(mode='json')
    # Add queue count
    result['queue_count'] = session_registry.get_queue_count(session_id)
    return result


@router.patch("/sessions/{session_id}", dependencies=[Depends(verify_secret)])
async def update_session(session_id: str, data: UpdateSessionRequest, request: Request):
    """Update session attributes"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Use update_status for status changes to sync control_state
    if 'status' in update_data:
        status = update_data.pop('status')
        session = session_registry.update_status(session_id, status)
    
    # Update other fields if any
    if update_data:
        session = session_registry.update(session_id, **update_data)
    
    # Emit sessions_update
    sio = getattr(request.app.state, "sio", None)
    if sio:
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
        
        # Emit cli_thinking_done when status changes to waiting (CLI finished)
        if data.status == 'waiting':
            await sio.emit("cli_thinking_done", {"session_id": session_id})
    
    return {"success": True, "session": session.model_dump(mode='json')}


@router.patch("/sessions/{session_id}/rename")
async def rename_session(session_id: str, name: str, request: Request):
    """Rename a session"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    
    # Rename in database
    result = get_session_repo().rename(session_id, name.strip())
    if not result:
        raise HTTPException(status_code=500, detail="Failed to rename session")
    
    # Get updated session
    session = session_registry.get(session_id)
    
    # Emit sessions_update
    sio = getattr(request.app.state, "sio", None)
    if sio:
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
    
    return {"success": True, "session": session.model_dump(mode='json')}


@router.delete("/sessions/{session_id}", dependencies=[Depends(verify_secret)])
async def delete_session(session_id: str, request: Request):
    """Delete a session"""
    # Get session before deleting to access project_dir
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Clear droid exec session for this project (if any)
    task_executor.clear_session(session.project_dir)
    
    # Remove session from registry
    success = session_registry.remove(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Cancel any pending waits
    message_queue.cancel_all_waits(session_id)
    
    # Emit sessions_update to notify connected clients
    sio = getattr(request.app.state, "sio", None)
    if sio:
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
    
    return {"success": True}


@router.post("/sessions/{session_id}/notify", dependencies=[Depends(verify_secret)])
async def notify_session(session_id: str, data: NotifyRequest, request: Request):
    """Send notification to Telegram for a session"""
    session = session_registry.get(session_id)
    if not session:
        # Auto-register session
        session = session_registry.register(
            session_id=session_id,
            project_dir="",
            name=data.session_name
        )
    
    # Create pending request only for actionable notifications (permission or has buttons)
    request_id = str(uuid.uuid4())
    needs_action = data.type == NotificationType.PERMISSION or (data.buttons and len(data.buttons) > 0)
    
    logger.info(f"Notify: type={data.type}, needs_action={needs_action}, buttons={len(data.buttons) if data.buttons else 0}")
    
    # Only set pending_request if user action is needed
    if needs_action:
        pending = PendingRequest(
            id=request_id,
            type=data.type,
            message=data.message,
            tool_name=data.tool_name,
            tool_input=data.tool_input,
            buttons=[Button(**b.model_dump()) for b in data.buttons] if data.buttons else []
        )
        session_registry.set_pending_request(session_id, pending)
    else:
        # Clear any existing pending_request for this session (info notifications should clear it)
        session_registry.set_pending_request(session_id, None)
    
    # Send to Telegram
    bot_manager = request.app.state.bot_manager()
    if bot_manager and bot_manager.is_connected:
        from core.models import Notification
        notification = Notification(
            session_id=session_id,
            session_name=data.session_name,
            message=data.message,
            type=data.type,
            buttons=data.buttons
        )
        await bot_manager.send_notification(notification)
    
    # Emit Socket.IO events
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("notification", {
            "session_id": session_id,
            "session_name": data.session_name,
            "message": data.message,
            "type": data.type.value if hasattr(data.type, 'value') else data.type,
            "request_id": request_id
        })
        # Also emit sessions_update so Web UI refreshes
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
    
    return {"success": True, "request_id": request_id}


@router.post("/sessions/{session_id}/wait", dependencies=[Depends(verify_secret)])
async def wait_for_response(session_id: str, data: WaitRequest):
    """Wait for user response (blocking)"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update status to waiting
    session_registry.update_status(session_id, SessionStatus.WAITING)
    
    # Wait for response
    response = await message_queue.wait_for_response(
        session_id=session_id,
        request_id=data.request_id,
        timeout=data.timeout
    )
    
    if response is None:
        return WaitResponse(timeout=True, has_response=False)
    
    # Clear pending request
    session_registry.set_pending_request(session_id, None)
    
    return WaitResponse(response=response, timeout=False, has_response=True)


@router.get("/sessions/{session_id}/response/{request_id}", dependencies=[Depends(verify_secret)])
async def get_pending_response(session_id: str, request_id: str):
    """Check for pending response without blocking"""
    response = message_queue.get_pending_response(session_id, request_id)
    
    if response is None:
        return WaitResponse(has_response=False)
    
    return WaitResponse(response=response, has_response=True)


@router.post("/sessions/{session_id}/respond", dependencies=[Depends(verify_secret)])
async def respond_to_session(session_id: str, data: RespondRequest, request: Request):
    """Deliver a response to a waiting session"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Deliver response
    success = message_queue.deliver_response(
        session_id=session_id,
        request_id=data.request_id,
        response=data.response
    )
    
    # Update status
    session_registry.update_status(session_id, SessionStatus.RUNNING)
    
    # Emit Socket.IO event
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("response_delivered", {
            "session_id": session_id,
            "request_id": data.request_id
        })
    
    return {"success": success}


# Task Execution Endpoints (droid exec)

@router.post("/tasks/execute", response_model=TaskResponse)
async def execute_task(data: TaskExecuteRequest, request: Request):
    """
    Execute a task using droid exec (headless mode).
    Returns immediately with task_id, executes in background.
    Results delivered via WebSocket 'task_completed' event.
    """
    task_id = data.task_id or str(uuid.uuid4())
    sio = getattr(request.app.state, "sio", None)
    
    # Create/update session immediately so it appears in sidebar
    pending_session_id = data.session_id
    if not pending_session_id:
        # Check if we have a stored session for this project in task_executor
        pending_session_id = task_executor._session_map.get(data.project_dir)
    
    # If still no session, create a pending one with task_id
    created_pending = False
    if not pending_session_id:
        pending_session_id = task_id  # Use task_id as temporary session_id
        from pathlib import Path
        session_name = Path(data.project_dir).name or "custom-task"
        try:
            session_repo = get_session_repo()
            session_repo.create(
                session_id=pending_session_id,
                name=session_name,
                project_dir=data.project_dir,
                status="running",
                control_state="remote_active"
            )
            created_pending = True
            logger.info(f"Created pending session {pending_session_id} for {data.project_dir}")
            
            # Emit sessions_update so sidebar shows the new session
            if sio:
                all_sessions = session_registry.get_all()
                await sio.emit("sessions_update", [s.model_dump(mode='json') for s in all_sessions])
        except Exception as e:
            logger.error(f"Failed to create pending session: {e}")
    
    # Notify that task is starting
    if sio:
        await sio.emit("task_started", {
            "task_id": task_id,
            "project_dir": data.project_dir,
            "prompt": data.prompt,
            "session_id": pending_session_id
        })
    
    # Determine which session_id to use for droid exec
    droid_session_id = None
    if data.session_id:
        session = session_registry.get(data.session_id)
        if session and session.status in ('running', 'waiting'):
            droid_session_id = data.session_id
            logger.info(f"Continuing CLI session {droid_session_id} via Web UI")
    
    # Get bot_manager for later use in background task
    bot_manager_getter = getattr(request.app.state, "bot_manager", None)
    
    # Background task to execute droid with real-time streaming
    async def run_task_in_background():
        try:
            final_result = None
            final_session_id = None
            
            # Use streaming to get real-time events
            async for event in task_executor.execute_task_streaming(
                task_id=task_id,
                prompt=data.prompt,
                project_dir=data.project_dir,
                session_id=droid_session_id,
                autonomy_level=data.autonomy_level,
                model=data.model,
                reasoning_effort=data.reasoning_effort,
                images=data.images
            ):
                event_type = event.get("type")
                
                # Emit activity events to frontend
                if sio and event_type in ("message", "tool_call", "tool_result"):
                    await sio.emit("task_activity", {
                        "task_id": task_id,
                        "session_id": pending_session_id,
                        "event": event
                    })
                
                # Capture completion event
                if event_type == "completion":
                    final_result = event.get("finalText", "")
                    final_session_id = event.get("session_id")
            
            # Get task result
            task = task_executor.get_task(task_id)
            result = task.result if task else None
            
            # Use captured data if task result not available
            if not result:
                from core.task_executor import TaskResult
                result = TaskResult(
                    success=True,
                    result=final_result or "",
                    session_id=final_session_id
                )
            
            # If we created a pending session with task_id, but droid returned a different session_id,
            # delete the pending one and create/update the real one
            if created_pending and result.session_id and result.session_id != pending_session_id:
                try:
                    session_repo = get_session_repo()
                    # Delete pending session
                    session_repo.delete(pending_session_id)
                    
                    # Create or update the real session
                    from pathlib import Path
                    session_name = Path(data.project_dir).name or "custom-task"
                    existing = session_repo.get(result.session_id)
                    if not existing:
                        session_repo.create(
                            session_id=result.session_id,
                            name=session_name,
                            project_dir=data.project_dir,
                            status="running",
                            control_state="remote_active"
                        )
                        logger.info(f"Created real session {result.session_id} for {data.project_dir}")
                    
                    logger.info(f"Deleted pending session {pending_session_id}, using real session {result.session_id}")
                except Exception as e:
                    logger.error(f"Failed to handle session transition: {e}")
            
            # Notify completion via WebSocket
            if sio:
                await sio.emit("task_completed", {
                    "task_id": task_id,
                    "success": result.success,
                    "result": result.result or "",
                    "session_id": result.session_id,
                    "duration_ms": result.duration_ms,
                    "num_turns": result.num_turns,
                    "error": result.error
                })
                
                # Update sidebar with correct sessions
                all_sessions = session_registry.get_all()
                await sio.emit("sessions_update", [s.model_dump(mode='json') for s in all_sessions])
            
            # Send Telegram notification
            if bot_manager_getter:
                bot_manager = bot_manager_getter()
                if bot_manager:
                    session_url = f"{WEB_UI_URL}/session/{result.session_id}" if result.session_id else None
                    
                    result_text = result.result or ""
                    if TELEGRAM_TASK_RESULT_MAX_LENGTH > 0 and len(result_text) > TELEGRAM_TASK_RESULT_MAX_LENGTH:
                        result_text = result_text[:TELEGRAM_TASK_RESULT_MAX_LENGTH] + "..."
                    
                    result_text = result_text.replace("_", "\\_").replace("*", "\\*").replace("`", "\\`")
                    
                    status_emoji = "✅" if result.success else "❌"
                    project_name = data.project_dir.replace("\\", "/").split("/")[-1]
                    
                    message_parts = [
                        f"{status_emoji} *Task Completed*",
                        f"📁 Project: `{project_name}`",
                        f"💬 Prompt: _{data.prompt[:100]}{'...' if len(data.prompt) > 100 else ''}_",
                        "",
                        f"📝 *Result:*",
                        result_text if result_text else "(no output)"
                    ]
                    
                    if session_url:
                        message_parts.append("")
                        message_parts.append(f"🔗 [Open in Web UI]({session_url})")
                    
                    await bot_manager.send_text("\n".join(message_parts))
                    
        except Exception as e:
            logger.error(f"Background task failed: {e}")
            # Notify error via WebSocket
            if sio:
                await sio.emit("task_completed", {
                    "task_id": task_id,
                    "success": False,
                    "result": "",
                    "session_id": pending_session_id,
                    "error": str(e)
                })
    
    # Start background task and return immediately
    asyncio.create_task(run_task_in_background())
    
    return TaskResponse(
        success=True,  # Request accepted
        result=None,
        task_id=task_id,
        session_id=pending_session_id,
        status="pending"
    )


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str, request: Request):
    """Cancel a running task."""
    success = task_executor.cancel_task(task_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Task not found or not running")
    
    # Notify cancellation
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("task_cancelled", {
            "task_id": task_id
        })
    
    return {"success": True, "message": "Task cancelled"}


@router.get("/tasks/{project_dir:path}/session")
async def get_project_session(project_dir: str):
    """Get the stored session ID for a project (for continuation)."""
    session_id = task_executor.get_session_id(project_dir)
    return {"session_id": session_id}


@router.delete("/tasks/{project_dir:path}/session")
async def clear_project_session(project_dir: str):
    """Clear the stored session for a project (start fresh)."""
    success = task_executor.clear_session(project_dir)
    return {"success": success}


# Queue Management Endpoints

@router.get("/sessions/{session_id}/queue")
async def get_session_queue(session_id: str):
    """Get queued messages for a session"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    messages = session_registry.get_queued_messages(session_id)
    return {"session_id": session_id, "messages": messages, "count": len(messages)}


@router.post("/sessions/{session_id}/queue")
async def add_to_queue(session_id: str, content: str, source: str = "web", request: Request = None):
    """Add a message to the queue"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    message = session_registry.queue_message(session_id, content, source)
    
    # Get queue count for notification
    queue_count = session_registry.get_queue_count(session_id)
    
    # Emit queue update event
    sio = getattr(request.app.state, "sio", None) if request else None
    if sio:
        messages = session_registry.get_queued_messages(session_id)
        await sio.emit("queue_updated", {
            "session_id": session_id,
            "queue": messages
        })
    
    # Send Telegram notification
    from bot.telegram_bot import TelegramBotManager
    bot = TelegramBotManager.get_instance()
    if bot:
        truncated = content[:50] + "..." if len(content) > 50 else content
        truncated = truncated.replace("_", "\\_").replace("*", "\\*").replace("`", "\\`")
        await bot.send_notification(
            f"⏳ *Task Queued* \\(#{queue_count}\\)\n"
            f"📁 `{session.name}`\n"
            f"💬 _{truncated}_",
            parse_mode="Markdown"
        )
    
    return {"success": True, "message": message}


@router.delete("/sessions/{session_id}/queue/{message_id}")
async def cancel_queued_message(session_id: str, message_id: int, request: Request):
    """Cancel a specific queued message"""
    success = session_registry.cancel_queued_message(message_id)
    if not success:
        raise HTTPException(status_code=404, detail="Message not found or already processed")
    
    # Emit queue update event
    sio = getattr(request.app.state, "sio", None)
    if sio:
        messages = session_registry.get_queued_messages(session_id)
        await sio.emit("queue_updated", {
            "session_id": session_id,
            "queue": messages
        })
    
    return {"success": True}


@router.delete("/sessions/{session_id}/queue")
async def clear_session_queue(session_id: str, request: Request):
    """Clear all queued messages for a session"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    count = session_registry.clear_queue(session_id)
    
    # Emit queue update event
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("queue_updated", {
            "session_id": session_id,
            "queue": []
        })
    
    return {"success": True, "cleared_count": count}


@router.post("/sessions/{session_id}/queue/send-next")
async def send_next_queued(session_id: str, request: Request):
    """Send the next queued message"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if remote control is active
    if not session_registry.can_execute_remote_task(session_id):
        raise HTTPException(
            status_code=400, 
            detail=f"Session not under remote control (state: {session.control_state})"
        )
    
    # Get next message
    message = session_registry.get_next_queued_message(session_id)
    if not message:
        return {"success": False, "message": "No messages in queue"}
    
    # Mark as sent
    session_registry.mark_message_sent(message['id'])
    
    # Execute the task
    task_id = str(uuid.uuid4())
    result = await task_executor.execute_task(
        task_id=task_id,
        prompt=message['content'],
        project_dir=session.project_dir,
        session_id=session_id,
        source="web"
    )
    
    # Emit queue update event
    sio = getattr(request.app.state, "sio", None)
    if sio:
        messages = session_registry.get_queued_messages(session_id)
        await sio.emit("queue_updated", {
            "session_id": session_id,
            "queue": messages
        })
    
    return {
        "success": True,
        "message": message,
        "result": {
            "success": result.success,
            "result": result.result[:500] if result.result else "",
            "task_id": task_id
        }
    }


@router.post("/sessions/{session_id}/queue/process")
async def process_queue_item(session_id: str, request: Request):
    """Process next queued message (called by Stop hook when CLI finishes)"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get next message
    message = session_registry.get_next_queued_message(session_id)
    if not message:
        return {"success": False, "message": "No messages in queue"}
    
    # Mark as sent
    session_registry.mark_message_sent(message['id'])
    
    # Execute the task in background
    task_id = str(uuid.uuid4())
    
    # Get socket for emitting events
    sio = getattr(request.app.state, "sio", None)
    
    async def run_task():
        try:
            result = await task_executor.execute_task(
                task_id=task_id,
                prompt=message['content'],
                project_dir=session.project_dir,
                session_id=session_id,
                source="queue"
            )
            # Emit completion
            if sio:
                await sio.emit("task_completed", {
                    "session_id": session_id,
                    "task_id": task_id,
                    "success": result.success,
                    "result": result.result
                })
        except Exception as e:
            logger.error(f"Queue task execution failed: {e}")
            if sio:
                await sio.emit("task_error", {
                    "session_id": session_id,
                    "task_id": task_id,
                    "error": str(e)
                })
    
    # Start task in background
    asyncio.create_task(run_task())
    
    # Emit queue update event
    if sio:
        messages = session_registry.get_queued_messages(session_id)
        await sio.emit("queue_updated", {
            "session_id": session_id,
            "queue": messages
        })
    
    return {
        "success": True,
        "task": {
            "id": task_id,
            "prompt": message['content'],
            "source": "queue"
        }
    }


# Control State Endpoints

@router.post("/sessions/{session_id}/handoff")
async def handoff_session(session_id: str, request: Request):
    """Hand off control from CLI to remote"""
    session = session_registry.handoff_to_remote(session_id)
    if not session:
        raise HTTPException(status_code=400, detail="Cannot handoff - session not in CLI state")
    
    # Emit state change event
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("session_state_changed", {
            "session_id": session_id,
            "control_state": session.control_state
        })
        # Also emit sessions_update
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
    
    return {"success": True, "session": session.model_dump(mode='json')}


@router.post("/sessions/{session_id}/release")
async def release_session(session_id: str, request: Request):
    """Release control back to CLI"""
    session = session_registry.release_to_cli(session_id)
    if not session:
        raise HTTPException(status_code=400, detail="Cannot release - session not under remote control")
    
    # Emit state change event
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("session_state_changed", {
            "session_id": session_id,
            "control_state": session.control_state
        })
        # Also emit sessions_update
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
    
    return {"success": True, "session": session.model_dump(mode='json')}


# History and Troubleshooting Endpoints

@router.get("/sessions/{session_id}/permissions")
async def get_permission_history(session_id: str, limit: int = 50):
    """Get permission request history for a session"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    permissions = get_permission_repo().get_history(session_id=session_id, limit=limit)
    return {"session_id": session_id, "permissions": permissions}


@router.get("/permissions")
async def get_all_permissions(limit: int = 50):
    """Get all permission requests (for troubleshooting)"""
    permissions = get_permission_repo().get_history(limit=limit)
    return {"permissions": permissions}


@router.post("/sessions/{session_id}/permissions/{request_id}/resolve")
async def resolve_permission(session_id: str, request_id: str, decision: str, request: Request):
    """Resolve a permission request from Web UI"""
    if decision not in ["approved", "denied"]:
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'denied'")
    
    # Resolve in database
    perm = get_permission_repo().resolve(request_id, decision, "web")
    if not perm:
        raise HTTPException(status_code=404, detail="Permission request not found")
    
    # Deliver response to waiting session
    response = "approve" if decision == "approved" else "deny"
    message_queue.deliver_response(session_id, request_id, response)
    
    # Emit event
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("permission_resolved", {
            "session_id": session_id,
            "request_id": request_id,
            "decision": decision
        })
    
    return {"success": True, "permission": perm}


@router.get("/sessions/{session_id}/events")
async def get_session_events(session_id: str, limit: int = 100):
    """Get session events for troubleshooting"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    events = get_event_repo().get_by_session(session_id, limit=limit)
    return {"session_id": session_id, "events": events}


@router.get("/sessions/{session_id}/timeline")
async def get_session_timeline(session_id: str, limit: int = 50):
    """Get unified timeline for a session (events, permissions, tasks)"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    timeline = get_event_repo().get_timeline(session_id, limit=limit)
    return {"session_id": session_id, "timeline": timeline}


@router.get("/tasks")
async def get_task_history(
    session_id: Optional[str] = None,
    source: Optional[str] = None,
    success_only: bool = False,
    limit: int = 50
):
    """Get task execution history"""
    tasks = get_task_repo().get_history(
        session_id=session_id,
        source=source,
        success_only=success_only,
        limit=limit
    )
    return {"tasks": tasks}


@router.get("/tasks/failed")
async def get_failed_tasks(limit: int = 20):
    """Get failed tasks for troubleshooting"""
    tasks = get_task_repo().get_failed(limit=limit)
    return {"tasks": tasks}


# Chat History Endpoints
@router.get("/sessions/{session_id}/chat")
async def get_chat_history(session_id: str, limit: int = 30, offset: int = 0):
    """Get chat messages for a session (newest first for pagination)"""
    repo = get_chat_repo()
    messages = repo.get_by_session_paginated(session_id, limit=limit, offset=offset)
    total = repo.count_by_session(session_id)
    has_more = offset + len(messages) < total
    return {
        "session_id": session_id,
        "messages": messages,
        "total": total,
        "has_more": has_more,
        "offset": offset,
        "limit": limit
    }


@router.post("/sessions/{session_id}/chat")
async def add_chat_message(
    session_id: str,
    msg_type: str,
    content: str,
    request: Request,
    status: Optional[str] = None,
    duration_ms: Optional[int] = None,
    num_turns: Optional[int] = None,
    source: str = 'web'
):
    """Add a chat message"""
    message = get_chat_repo().create(
        session_id=session_id,
        msg_type=msg_type,
        content=content,
        status=status,
        duration_ms=duration_ms,
        num_turns=num_turns,
        source=source
    )
    
    # Clear thinking state when assistant message is added from CLI
    if msg_type == 'assistant' and source == 'cli':
        cli_thinking_state[session_id] = False
    
    # Emit WebSocket event so Web UI updates
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("chat_updated", {
            "session_id": session_id,
            "message": message
        })
        # Also emit explicit cli_thinking_done to ensure thinking state is cleared
        if msg_type == 'assistant' and source == 'cli':
            await sio.emit("cli_thinking_done", {
                "session_id": session_id
            })
    
    return {"success": True, "message": message}


@router.delete("/sessions/{session_id}/chat")
async def clear_chat_history(session_id: str):
    """Clear all chat messages for a session"""
    count = get_chat_repo().clear_session(session_id)
    return {"success": True, "deleted": count}


@router.post("/sessions/{session_id}/cli-thinking")
async def cli_thinking(session_id: str, request: Request):
    """Notify Web UI that CLI is processing a prompt (show thinking indicator)"""
    body = await request.json()
    prompt = body.get("prompt", "")
    
    # Store thinking state so new connections can check it
    cli_thinking_state[session_id] = True
    
    # Emit WebSocket event so Web UI shows thinking indicator
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("cli_thinking", {
            "session_id": session_id,
            "prompt": prompt
        })
    
    return {"success": True}


@router.get("/sessions/{session_id}/cli-thinking")
async def get_cli_thinking(session_id: str):
    """Check if CLI is currently thinking for this session"""
    return {"thinking": cli_thinking_state.get(session_id, False)}


# Session Settings Endpoints
@router.get("/sessions/{session_id}/settings")
async def get_session_settings(session_id: str):
    """Get settings for a session"""
    settings = get_settings_repo().get(session_id)
    if not settings:
        # Return defaults
        settings = {
            "session_id": session_id,
            "model": "claude-sonnet-4-5-20250929",
            "reasoning_effort": "medium",
            "autonomy_level": "high"
        }
    return settings


@router.put("/sessions/{session_id}/settings")
async def update_session_settings(
    session_id: str,
    model: Optional[str] = None,
    reasoning_effort: Optional[str] = None,
    autonomy_level: Optional[str] = None
):
    """Update settings for a session"""
    settings = get_settings_repo().upsert(
        session_id=session_id,
        model=model,
        reasoning_effort=reasoning_effort,
        autonomy_level=autonomy_level
    )
    return {"success": True, "settings": settings}


# Image Upload Endpoints
@router.post("/upload-image")
async def upload_image(
    image: UploadFile = File(...),
    session_id: str = Form("unknown")
):
    """Upload image to Cloudinary and return public URL"""
    from .cloudinary_handler import upload_to_cloudinary
    
    try:
        content = await image.read()
        result = upload_to_cloudinary(content, image.filename or "image.png", session_id)
        
        return {
            'success': True,
            'url': result['url'],
            'public_id': result['public_id'],
            'width': result.get('width'),
            'height': result.get('height'),
            'format': result.get('format'),
            'size': result.get('size')
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="Upload failed")


@router.post("/delete-image")
async def delete_image(request: Request):
    """Delete image from Cloudinary"""
    from .cloudinary_handler import delete_from_cloudinary
    
    try:
        data = await request.json()
        public_id = data.get('public_id')
        
        if not public_id:
            raise HTTPException(status_code=400, detail='public_id required')
        
        success = delete_from_cloudinary(public_id)
        return {'success': success}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Filesystem Browser Endpoint
@router.get("/filesystem/browse")
async def browse_filesystem(path: Optional[str] = None):
    """Browse filesystem directories for project selection"""
    import os
    import platform
    
    result = {
        "current_path": "",
        "parent": None,
        "directories": [],
        "drives": []
    }
    
    # Get available drives on Windows
    if platform.system() == "Windows":
        import string
        drives = []
        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\"
            if os.path.exists(drive):
                drives.append(drive)
        result["drives"] = drives
    
    # Default to home directory if no path provided
    if not path:
        path = os.path.expanduser("~")
    
    # Normalize path
    path = os.path.normpath(path)
    
    # Check if path exists
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Path not found: {path}")
    
    # Check if path is a directory
    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail=f"Not a directory: {path}")
    
    result["current_path"] = path
    
    # Get parent directory
    parent = os.path.dirname(path)
    if parent != path:  # Not at root
        result["parent"] = parent
    
    # List subdirectories
    try:
        entries = os.listdir(path)
        directories = []
        for entry in sorted(entries):
            # Skip hidden files/folders
            if entry.startswith('.'):
                continue
            full_path = os.path.join(path, entry)
            try:
                if os.path.isdir(full_path):
                    directories.append({
                        "name": entry,
                        "path": full_path
                    })
            except PermissionError:
                continue
        result["directories"] = directories
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied: {path}")
    
    return result


# Permission Allowlist Endpoints

@router.get("/allowlist")
async def get_allowlist():
    """Get all permission allowlist rules"""
    from core.repositories import get_allowlist_repo
    rules = get_allowlist_repo().get_all()
    return {"rules": rules}


@router.post("/allowlist")
async def add_allowlist_rule(tool_name: str, pattern: str, description: Optional[str] = None):
    """Add a permission allowlist rule"""
    from core.repositories import get_allowlist_repo
    rule = get_allowlist_repo().add(tool_name, pattern, description)
    if rule:
        return {"success": True, "rule": rule}
    else:
        raise HTTPException(status_code=400, detail="Failed to add rule (may already exist)")


@router.delete("/allowlist/{rule_id}")
async def remove_allowlist_rule(rule_id: int):
    """Remove a permission allowlist rule"""
    from core.repositories import get_allowlist_repo
    success = get_allowlist_repo().remove(rule_id)
    if success:
        return {"success": True}
    else:
        raise HTTPException(status_code=404, detail="Rule not found")


@router.get("/allowlist/check")
async def check_allowlist(tool_name: str, tool_input: str = "{}"):
    """
    Check if a tool call is allowed by the allowlist.
    tool_input should be JSON-encoded.
    Used by PreToolUse hook for quick check.
    """
    import json
    from core.repositories import get_allowlist_repo
    
    try:
        input_dict = json.loads(tool_input)
    except json.JSONDecodeError:
        input_dict = {"raw": tool_input}
    
    allowed = get_allowlist_repo().is_allowed(tool_name, input_dict)
    return {"allowed": allowed, "tool_name": tool_name}
