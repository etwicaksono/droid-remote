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
    async def connect(sid, environ, auth=None):
        """Handle client connection (auth contains token if provided)"""
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
    
    def _create_permission_rule(session_id: str, rule_type: str, scope: str):
        """Helper to create a permission rule from pending request"""
        import json
        from core.repositories import get_permission_rules_repo
        
        session = session_registry.get(session_id)
        if not session or not session.pending_request:
            return None
        
        pending = session.pending_request
        tool_name = pending.tool_name or ''
        tool_input = pending.tool_input or '{}'
        
        try:
            input_dict = json.loads(tool_input) if isinstance(tool_input, str) else tool_input
        except:
            input_dict = {}
        
        # Determine pattern based on tool type
        if tool_name == 'Execute':
            pattern = input_dict.get('command', '*')
        elif tool_name in ('Read', 'Edit', 'Create', 'MultiEdit'):
            pattern = input_dict.get('file_path', '*')
        else:
            pattern = '*'
        
        return get_permission_rules_repo().add(
            tool_name=tool_name,
            pattern=pattern,
            rule_type=rule_type,
            scope=scope,
            session_id=session_id if scope == 'session' else None
        )
    
    @sio.event
    async def approve(sid, data):
        """Handle approve action from Web UI"""
        session_id = data.get("sessionId")
        request_id = data.get("requestId")
        scope = data.get("scope")  # Optional: 'session' or 'global'
        
        if not session_id:
            return {"error": "Missing sessionId"}
        
        # Get request_id from session if not provided
        session = session_registry.get(session_id)
        if not request_id and session and session.pending_request:
            request_id = session.pending_request.id
        
        # Create permission rule if scope provided
        rule = None
        if scope in ('session', 'global'):
            rule = _create_permission_rule(session_id, 'allow', scope)
        
        message_queue.deliver_response(session_id, request_id, "approve")
        
        # Update permission in database
        if request_id:
            decision = f"approved_{scope}" if scope else "approved"
            get_permission_repo().resolve(request_id, decision, "web")
        
        session_registry.update_status(session_id, SessionStatus.RUNNING)
        session_registry.set_pending_request(session_id, None)
        
        # Broadcast update
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
        
        logger.info(f"Approved via WebSocket: session={session_id}, request={request_id}, scope={scope}")
        return {"success": True, "rule": rule}
    
    @sio.event
    async def deny(sid, data):
        """Handle deny action from Web UI"""
        session_id = data.get("sessionId")
        request_id = data.get("requestId")
        scope = data.get("scope")  # Optional: 'session' or 'global'
        
        if not session_id:
            return {"error": "Missing sessionId"}
        
        # Get request_id from session if not provided
        session = session_registry.get(session_id)
        if not request_id and session and session.pending_request:
            request_id = session.pending_request.id
        
        # Create permission rule if scope provided
        rule = None
        if scope in ('session', 'global'):
            rule = _create_permission_rule(session_id, 'deny', scope)
        
        message_queue.deliver_response(session_id, request_id, "deny")
        
        # Update permission in database
        if request_id:
            decision = f"denied_{scope}" if scope else "denied"
            get_permission_repo().resolve(request_id, decision, "web")
        
        session_registry.update_status(session_id, SessionStatus.RUNNING)
        session_registry.set_pending_request(session_id, None)
        
        # Broadcast update
        sessions = session_registry.get_all()
        await sio.emit("sessions_update", [s.model_dump(mode='json') for s in sessions])
        
        logger.info(f"Denied via WebSocket: session={session_id}, request={request_id}, scope={scope}")
        return {"success": True, "rule": rule}
    
    @sio.event
    async def always_allow(sid, data):
        """Handle always_allow action from Web UI - legacy, use approve with scope='global'"""
        data['scope'] = 'global'
        return await approve(sid, data)
    
    @sio.event
    async def get_sessions(sid):
        """Get all sessions"""
        sessions = session_registry.get_all()
        return [s.model_dump(mode='json') for s in sessions]
    
    return sio


def create_socketio_app(sio: socketio.AsyncServer, other_app):
    """Create ASGI app combining Socket.IO and another ASGI app"""
    return socketio.ASGIApp(sio, other_app)
