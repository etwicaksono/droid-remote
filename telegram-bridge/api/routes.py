"""
FastAPI REST API routes for the bridge server
"""
import os
import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request, Depends, Header

from core.session_registry import session_registry
from core.message_queue import message_queue
from core.task_executor import task_executor
from core.repositories import get_permission_repo, get_task_repo, get_event_repo, get_chat_repo, get_settings_repo
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

logger = logging.getLogger(__name__)
router = APIRouter()

# Secret for hook authentication
BRIDGE_SECRET = os.getenv("BRIDGE_SECRET", "")


def verify_secret(x_bridge_secret: Optional[str] = Header(None)):
    """Verify the bridge secret header"""
    if BRIDGE_SECRET and x_bridge_secret != BRIDGE_SECRET:
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


@router.get("/sessions", response_model=List[Session])
async def get_sessions():
    """Get all sessions"""
    return session_registry.get_all()


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get a single session by ID"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump(mode='json')


@router.patch("/sessions/{session_id}", dependencies=[Depends(verify_secret)])
async def update_session(session_id: str, data: UpdateSessionRequest, request: Request):
    """Update session attributes"""
    session = session_registry.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    update_data = data.model_dump(exclude_unset=True)
    session = session_registry.update(session_id, **update_data)
    
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
    
    pending = PendingRequest(
        id=request_id,
        type=data.type,
        message=data.message,
        buttons=[Button(**b.model_dump()) for b in data.buttons] if data.buttons else []
    )
    
    # Only set pending_request if user action is needed
    if needs_action:
        session_registry.set_pending_request(session_id, pending)
    
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
        message_id = await bot_manager.send_notification(notification)
        if message_id:
            pending.telegram_message_id = message_id
            session_registry.set_pending_request(session_id, pending)
    
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
    Returns the result and session_id for continuation.
    """
    task_id = data.task_id or str(uuid.uuid4())
    
    # Notify that task is starting
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("task_started", {
            "task_id": task_id,
            "project_dir": data.project_dir,
            "prompt": data.prompt
        })
    
    # Execute the task
    # Determine which session_id to use:
    # 1. If there's an ACTIVE (running) CLI session for this project → use its session_id
    # 2. Otherwise, let task_executor manage via _session_map
    
    droid_session_id = None
    
    # Check if data.session_id corresponds to an active CLI session
    if data.session_id:
        session = session_registry.get(data.session_id)
        if session and session.project_dir == data.project_dir:
            # Only use CLI session if it's still running
            # Don't use stopped/closed sessions (they're expired on Factory.ai)
            if session.status == 'running':
                # This is an ACTIVE CLI session for this project
                # The session_id IS the droid session_id from Factory.ai
                droid_session_id = data.session_id
                logger.info(f"Using active CLI session {droid_session_id} for task execution")
            else:
                logger.info(f"Session {data.session_id} is {session.status}, will use _session_map instead")
    
    result = await task_executor.execute_task(
        task_id=task_id,
        prompt=data.prompt,
        project_dir=data.project_dir,
        session_id=droid_session_id,  # Use CLI session if available
        autonomy_level=data.autonomy_level,
        model=data.model,
        reasoning_effort=data.reasoning_effort,
        source="api"
    )
    
    # Notify completion
    if sio:
        await sio.emit("task_completed", {
            "task_id": task_id,
            "success": result.success,
            "result": result.result[:500] if result.result else "",  # Truncate for event
            "session_id": result.session_id
        })
    
    return TaskResponse(
        success=result.success,
        result=result.result,
        task_id=task_id,
        session_id=result.session_id,
        duration_ms=result.duration_ms,
        num_turns=result.num_turns,
        error=result.error
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
    
    # Emit queue update event
    sio = getattr(request.app.state, "sio", None) if request else None
    if sio:
        messages = session_registry.get_queued_messages(session_id)
        await sio.emit("queue_updated", {
            "session_id": session_id,
            "queue": messages
        })
    
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
async def get_chat_history(session_id: str, limit: int = 100):
    """Get chat messages for a session"""
    messages = get_chat_repo().get_by_session(session_id, limit=limit)
    return {"session_id": session_id, "messages": messages}


@router.post("/sessions/{session_id}/chat")
async def add_chat_message(
    session_id: str,
    msg_type: str,
    content: str,
    status: Optional[str] = None,
    duration_ms: Optional[int] = None,
    num_turns: Optional[int] = None
):
    """Add a chat message"""
    message = get_chat_repo().create(
        session_id=session_id,
        msg_type=msg_type,
        content=content,
        status=status,
        duration_ms=duration_ms,
        num_turns=num_turns
    )
    return {"success": True, "message": message}


@router.delete("/sessions/{session_id}/chat")
async def clear_chat_history(session_id: str):
    """Clear all chat messages for a session"""
    count = get_chat_repo().clear_session(session_id)
    return {"success": True, "deleted": count}


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
            "reasoning_effort": "medium"
        }
    return settings


@router.put("/sessions/{session_id}/settings")
async def update_session_settings(
    session_id: str,
    model: Optional[str] = None,
    reasoning_effort: Optional[str] = None
):
    """Update settings for a session"""
    settings = get_settings_repo().upsert(
        session_id=session_id,
        model=model,
        reasoning_effort=reasoning_effort
    )
    return {"success": True, "settings": settings}
