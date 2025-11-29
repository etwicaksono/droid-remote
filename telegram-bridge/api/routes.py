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
    Button
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
        await sio.emit("sessions_update", [s.model_dump() for s in sessions])
    
    return {"success": True, "session": session.model_dump()}


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
async def delete_session(session_id: str):
    """Delete a session"""
    success = session_registry.remove(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Cancel any pending waits
    message_queue.cancel_all_waits(session_id)
    
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
    
    # Create pending request
    request_id = str(uuid.uuid4())
    pending = PendingRequest(
        id=request_id,
        type=data.type,
        message=data.message,
        buttons=[Button(**b.model_dump()) for b in data.buttons] if data.buttons else []
    )
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
