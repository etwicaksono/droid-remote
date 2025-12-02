"""
Session Registry - Tracks all active Droid sessions
SQLite-backed storage with in-memory pending request cache
"""
import os
import logging
from datetime import datetime
from typing import Dict, Optional, List
from threading import Lock

from .models import Session, SessionStatus, ControlState, PendingRequest
from .repositories import get_session_repo, get_permission_repo, get_queue_repo

logger = logging.getLogger(__name__)


class SessionRegistry:
    """
    SQLite-backed session storage with in-memory pending request cache.
    
    Benefits of SQLite:
    - Sessions persist across bridge restarts
    - Troubleshooting via SQL queries
    - Audit trail of all events
    - Queue persistence
    
    Pending requests are cached in-memory for quick access during
    active permission flows, but also stored in database for persistence.
    """
    
    def __init__(self):
        self._pending_requests: Dict[str, PendingRequest] = {}
        self._lock = Lock()
    
    def _dict_to_session(self, data: dict) -> Session:
        """Convert database dict to Session model"""
        # Handle datetime fields
        started_at = data.get('created_at')
        if isinstance(started_at, str):
            started_at = datetime.fromisoformat(started_at)
        
        last_activity = data.get('updated_at')
        if isinstance(last_activity, str):
            last_activity = datetime.fromisoformat(last_activity)
        
        # Get pending request from cache or database
        session_id = data['id']
        pending_request = self._pending_requests.get(session_id)
        
        if not pending_request:
            # Check database for pending permission request
            perm_repo = get_permission_repo()
            pending_perm = perm_repo.get_pending_by_session(session_id)
            if pending_perm:
                pending_request = PendingRequest(
                    id=pending_perm['id'],
                    type='permission',
                    message=pending_perm.get('message', ''),
                    tool_name=pending_perm.get('tool_name'),
                    tool_input=pending_perm.get('tool_input'),
                    telegram_message_id=pending_perm.get('telegram_message_id'),
                    created_at=pending_perm.get('created_at', datetime.utcnow())
                )
        
        # Handle invalid control_state values gracefully
        try:
            control_state = ControlState(data.get('control_state', 'cli_active'))
        except ValueError:
            # Fallback to remote_active for invalid states (e.g., old 'exec_mode')
            control_state = ControlState.REMOTE_ACTIVE
        
        return Session(
            id=session_id,
            name=data['name'],
            project_dir=data['project_dir'],
            status=SessionStatus(data.get('status', 'running')),
            control_state=control_state,
            started_at=started_at or datetime.utcnow(),
            last_activity=last_activity or datetime.utcnow(),
            pending_request=pending_request,
            transcript_path=data.get('transcript_path')
        )
    
    def register(
        self,
        session_id: str,
        project_dir: str,
        name: Optional[str] = None,
        transcript_path: Optional[str] = None
    ) -> Session:
        """Register or update a session (multiple sessions per project_dir allowed)"""
        repo = get_session_repo()
        
        with self._lock:
            # Check if this session_id already exists (re-registration)
            existing = repo.get_by_id(session_id)
            if existing:
                # Update existing session
                data = repo.upsert(
                    session_id=session_id,
                    name=existing['name'],  # Keep existing name
                    project_dir=project_dir,
                    status='running',
                    transcript_path=transcript_path
                )
                session = self._dict_to_session(data)
                logger.info(f"Updated session: {session_id} ({session.name})")
                return session
            
            # New session - generate name with numbering if needed
            base_name = name or os.path.basename(project_dir) or "unknown"
            final_name = self._generate_unique_name(repo, base_name, project_dir)
            
            # Create new session
            data = repo.upsert(
                session_id=session_id,
                name=final_name,
                project_dir=project_dir,
                status='running',
                transcript_path=transcript_path
            )
            
            # Clear any cached pending request
            self._pending_requests.pop(session_id, None)
            
            session = self._dict_to_session(data)
            logger.info(f"Registered session: {session_id} ({final_name})")
            return session
    
    def _generate_unique_name(self, repo, base_name: str, project_dir: str) -> str:
        """Generate unique session name with numbering for same project_dir"""
        # Get all sessions for this project directory
        all_sessions = repo.get_all()
        existing_names = [s['name'] for s in all_sessions if s['project_dir'] == project_dir]
        
        if not existing_names:
            return base_name
        
        # Check if base_name is already taken
        if base_name not in existing_names:
            return base_name
        
        # Find the next available number
        max_num = 1
        for name in existing_names:
            if name == base_name:
                max_num = max(max_num, 1)
            elif name.startswith(f"{base_name} #"):
                try:
                    num = int(name.split("#")[-1].strip())
                    max_num = max(max_num, num)
                except ValueError:
                    pass
        
        return f"{base_name} #{max_num + 1}"
    
    def get(self, session_id: str) -> Optional[Session]:
        """Get a session by ID or prefix"""
        repo = get_session_repo()
        # Try exact match first
        data = repo.get_by_id(session_id)
        if data:
            return self._dict_to_session(data)
        # Try prefix match (for truncated Telegram callback IDs)
        if len(session_id) >= 8:
            data = repo.get_by_id_prefix(session_id)
            if data:
                return self._dict_to_session(data)
        return None
    
    def get_by_name(self, name: str) -> Optional[Session]:
        """Get a session by name"""
        repo = get_session_repo()
        for data in repo.get_all():
            if data['name'].lower() == name.lower():
                return self._dict_to_session(data)
        return None
    
    def get_by_project_dir(self, project_dir: str) -> Optional[Session]:
        """Get a session by project directory"""
        repo = get_session_repo()
        data = repo.get_by_project_dir(project_dir)
        if data:
            return self._dict_to_session(data)
        return None
    
    def get_by_index(self, index: int) -> Optional[Session]:
        """Get a session by its index (1-based)"""
        repo = get_session_repo()
        sessions = repo.get_all()
        if 1 <= index <= len(sessions):
            return self._dict_to_session(sessions[index - 1])
        return None
    
    def get_all(self) -> List[Session]:
        """Get all sessions"""
        repo = get_session_repo()
        return [self._dict_to_session(data) for data in repo.get_all(include_stopped=True)]
    
    def get_active_sessions(self) -> List[Session]:
        """Get all non-stopped sessions"""
        repo = get_session_repo()
        return [self._dict_to_session(data) for data in repo.get_all(include_stopped=False)]
    
    def get_waiting_sessions(self) -> List[Session]:
        """Get all waiting sessions"""
        repo = get_session_repo()
        sessions = []
        for data in repo.get_all():
            if data.get('status') == 'waiting':
                sessions.append(self._dict_to_session(data))
        return sessions
    
    def update(self, session_id: str, **kwargs) -> Optional[Session]:
        """Update session attributes"""
        repo = get_session_repo()
        
        # Handle pending_request separately (it's cached in memory)
        pending_request = kwargs.pop('pending_request', None)
        if pending_request is not None:
            with self._lock:
                if pending_request:
                    self._pending_requests[session_id] = pending_request
                else:
                    self._pending_requests.pop(session_id, None)
        
        # Map model fields to database fields
        db_kwargs = {}
        if 'status' in kwargs:
            status = kwargs['status']
            db_kwargs['status'] = status.value if isinstance(status, SessionStatus) else status
        
        # Update in database
        if db_kwargs:
            data = repo.update(session_id, **db_kwargs)
        else:
            data = repo.get_by_id(session_id)
        
        if data:
            return self._dict_to_session(data)
        return None
    
    def update_status(self, session_id: str, status: SessionStatus) -> Optional[Session]:
        """Update session status"""
        repo = get_session_repo()
        status_str = status.value if isinstance(status, SessionStatus) else status
        data = repo.update_status(session_id, status_str)
        if data:
            return self._dict_to_session(data)
        return None
    
    def set_pending_request(
        self,
        session_id: str,
        pending_request: Optional[PendingRequest]
    ) -> Optional[Session]:
        """Set or clear the pending request for a session"""
        with self._lock:
            if pending_request:
                self._pending_requests[session_id] = pending_request
                
                # Also store in database for permission requests
                if pending_request.type == 'permission' or pending_request.tool_name:
                    perm_repo = get_permission_repo()
                    perm_repo.create(
                        session_id=session_id,
                        message=pending_request.message,
                        tool_name=pending_request.tool_name,
                        tool_input=pending_request.tool_input,
                        request_id=pending_request.id,
                        telegram_message_id=pending_request.telegram_message_id
                    )
            else:
                self._pending_requests.pop(session_id, None)
        
        return self.get(session_id)
    
    def remove(self, session_id: str) -> bool:
        """Remove a session"""
        repo = get_session_repo()
        with self._lock:
            self._pending_requests.pop(session_id, None)
        
        if repo.delete(session_id):
            logger.info(f"Removed session: {session_id}")
            return True
        return False
    
    def clear_stale_sessions(self, max_age_seconds: int = 3600):
        """Remove sessions that haven't been active for a while"""
        repo = get_session_repo()
        now = datetime.utcnow()
        
        for data in repo.get_all(include_stopped=True):
            if data.get('status') == 'stopped':
                updated_at = data.get('updated_at')
                if isinstance(updated_at, str):
                    updated_at = datetime.fromisoformat(updated_at)
                
                if updated_at:
                    age = (now - updated_at).total_seconds()
                    if age > max_age_seconds:
                        session_id = data['id']
                        self.remove(session_id)
                        logger.info(f"Cleared stale session: {session_id}")
    
    # Control state management methods
    
    def update_control_state(self, session_id: str, control_state: ControlState) -> Optional[Session]:
        """Update session control state"""
        repo = get_session_repo()
        state_str = control_state.value if isinstance(control_state, ControlState) else control_state
        data = repo.update_control_state(session_id, state_str)
        if data:
            logger.info(f"Session {session_id} control state changed to {state_str}")
            return self._dict_to_session(data)
        return None
    
    def handoff_to_remote(self, session_id: str) -> Optional[Session]:
        """Hand off control from CLI to remote"""
        session = self.get(session_id)
        if not session:
            return None
        
        # Allow handoff from CLI states or RELEASED (re-taking control after release)
        allowed_states = [ControlState.CLI_ACTIVE, ControlState.CLI_WAITING, ControlState.RELEASED]
        if session.control_state not in allowed_states:
            logger.warning(f"Cannot handoff session {session_id}: state is {session.control_state}, expected one of {allowed_states}")
            return None
        
        return self.update_control_state(session_id, ControlState.REMOTE_ACTIVE)
    
    def release_to_cli(self, session_id: str) -> Optional[Session]:
        """Release control back to CLI"""
        session = self.get(session_id)
        if not session:
            return None
        
        # Only allow release from remote state
        if session.control_state != ControlState.REMOTE_ACTIVE:
            logger.warning(f"Cannot release session {session_id}: not in remote state")
            return None
        
        return self.update_control_state(session_id, ControlState.RELEASED)
    
    def set_cli_waiting(self, session_id: str) -> Optional[Session]:
        """Set CLI to waiting state (at stop point)"""
        return self.update_control_state(session_id, ControlState.CLI_WAITING)
    
    def set_cli_active(self, session_id: str) -> Optional[Session]:
        """Set CLI to active state"""
        return self.update_control_state(session_id, ControlState.CLI_ACTIVE)
    
    def get_remote_controlled_sessions(self) -> List[Session]:
        """Get all sessions under remote control"""
        repo = get_session_repo()
        sessions = []
        for data in repo.get_all():
            if data.get('control_state') == 'remote_active':
                sessions.append(self._dict_to_session(data))
        return sessions
    
    def can_execute_remote_task(self, session_id: str) -> bool:
        """Check if remote task execution is allowed for this session"""
        session = self.get(session_id)
        if not session:
            return False
        return session.control_state == ControlState.REMOTE_ACTIVE
    
    # Queue management methods
    
    def queue_message(self, session_id: str, content: str, source: str = 'telegram') -> dict:
        """Add a message to the queue for a session"""
        queue_repo = get_queue_repo()
        message = queue_repo.create(session_id, content, source)
        logger.info(f"Queued message for session {session_id} from {source}")
        return message
    
    def get_queued_messages(self, session_id: str) -> List[dict]:
        """Get all pending queued messages for a session"""
        queue_repo = get_queue_repo()
        return queue_repo.get_pending(session_id)
    
    def get_next_queued_message(self, session_id: str) -> Optional[dict]:
        """Get the next pending message in queue"""
        queue_repo = get_queue_repo()
        return queue_repo.get_next(session_id)
    
    def mark_message_sent(self, message_id: int) -> bool:
        """Mark a queued message as sent"""
        queue_repo = get_queue_repo()
        return queue_repo.mark_sent(message_id)
    
    def cancel_queued_message(self, message_id: int) -> bool:
        """Cancel a queued message"""
        queue_repo = get_queue_repo()
        return queue_repo.cancel(message_id)
    
    def clear_queue(self, session_id: str) -> int:
        """Clear all pending messages for a session"""
        queue_repo = get_queue_repo()
        count = queue_repo.clear_pending(session_id)
        logger.info(f"Cleared {count} queued messages for session {session_id}")
        return count
    
    def get_queue_count(self, session_id: str) -> int:
        """Get count of pending messages"""
        queue_repo = get_queue_repo()
        return queue_repo.count_pending(session_id)
    
    def should_queue_message(self, session_id: str) -> bool:
        """Check if incoming message should be queued (CLI is active)"""
        session = self.get(session_id)
        if not session:
            return False
        # Queue if CLI has control
        return session.control_state in [ControlState.CLI_ACTIVE, ControlState.CLI_WAITING]


# Global instance
session_registry = SessionRegistry()
