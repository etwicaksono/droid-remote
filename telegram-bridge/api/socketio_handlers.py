"""
Socket.IO event handlers for real-time Web UI updates
"""
import logging
from typing import Optional
import socketio

from core.session_registry import session_registry
from core.message_queue import message_queue
from core.models import SessionStatus
from core.repositories import get_permission_repo

logger = logging.getLogger(__name__)


def create_socketio_server() -> socketio.AsyncServer:
    """Create and configure Socket.IO server"""
    sio = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins="*",
        logger=False,
        engineio_logger=False
    )
    
    @sio.event
    async def connect(sid, environ):
        """Handle client connection"""
        logger.info(f"Client connected: {sid}")
        
        # Send current sessions
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions], to=sid)
    
    @sio.event
    async def disconnect(sid):
        """Handle client disconnection"""
        logger.info(f"Client disconnected: {sid}")
    
    @sio.event
    async def subscribe(sid, data):
        """Subscribe to a specific session's updates"""
        session_id = data.get("sessionId")
        if session_id:
            await sio.enter_room(sid, f"session:{session_id}")
            logger.info(f"Client {sid} subscribed to session {session_id}")
    
    @sio.event
    async def unsubscribe(sid, data):
        """Unsubscribe from a session's updates"""
        session_id = data.get("sessionId")
        if session_id:
            await sio.leave_room(sid, f"session:{session_id}")
            logger.info(f"Client {sid} unsubscribed from session {session_id}")
    
    @sio.event
    async def respond(sid, data):
        """Handle response from Web UI"""
        session_id = data.get("sessionId")
        request_id = data.get("requestId")
        response = data.get("response")
        
        if not session_id or not response:
            return {"error": "Missing sessionId or response"}
        
        session = session_registry.get(session_id)
        if not session:
            return {"error": "Session not found"}
        
        # Deliver response
        message_queue.deliver_response(session_id, request_id, response)
        session_registry.update_status(session_id, SessionStatus.RUNNING)
        session_registry.set_pending_request(session_id, None)
        
        # Broadcast update
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
        
        logger.info(f"Response delivered via WebSocket: session={session_id}")
        return {"success": True}
    
    @sio.event
    async def approve(sid, data):
        """Handle approve action from Web UI"""
        session_id = data.get("sessionId")
        request_id = data.get("requestId")
        
        if not session_id:
            return {"error": "Missing sessionId"}
        
        # Get request_id from session if not provided
        session = session_registry.get(session_id)
        if not request_id and session and session.pending_request:
            request_id = session.pending_request.id
        
        message_queue.deliver_response(session_id, request_id, "approve")
        
        # Update permission in database
        if request_id:
            get_permission_repo().resolve(request_id, "approved", "web")
        
        session_registry.update_status(session_id, SessionStatus.RUNNING)
        session_registry.set_pending_request(session_id, None)
        
        # Broadcast update
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
        
        logger.info(f"Approved via WebSocket: session={session_id}, request={request_id}")
        return {"success": True}
    
    @sio.event
    async def deny(sid, data):
        """Handle deny action from Web UI"""
        session_id = data.get("sessionId")
        request_id = data.get("requestId")
        
        if not session_id:
            return {"error": "Missing sessionId"}
        
        # Get request_id from session if not provided
        session = session_registry.get(session_id)
        if not request_id and session and session.pending_request:
            request_id = session.pending_request.id
        
        message_queue.deliver_response(session_id, request_id, "deny")
        
        # Update permission in database
        if request_id:
            get_permission_repo().resolve(request_id, "denied", "web")
        
        session_registry.update_status(session_id, SessionStatus.RUNNING)
        session_registry.set_pending_request(session_id, None)
        
        # Broadcast update
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
        
        logger.info(f"Denied via WebSocket: session={session_id}, request={request_id}")
        return {"success": True}
    
    @sio.event
    async def get_sessions(sid):
        """Get all sessions"""
        sessions = session_registry.get_all()
        return [s.model_dump(mode='json') for s in sessions]
    
    return sio


def create_socketio_app(sio: socketio.AsyncServer, other_app):
    """Create ASGI app combining Socket.IO and another ASGI app"""
    return socketio.ASGIApp(sio, other_app)
