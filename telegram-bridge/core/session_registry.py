"""
Session Registry - Tracks all active Droid sessions
In-memory storage (sessions are transient)
"""
import logging
from datetime import datetime
from typing import Dict, Optional, List
from threading import Lock

from .models import Session, SessionStatus, PendingRequest

logger = logging.getLogger(__name__)


class SessionRegistry:
    """
    In-memory session storage.
    
    Why no database?
    - Sessions are transient (tied to Droid lifetime)
    - Hooks re-register on every event anyway
    - Simpler = more reliable
    - If bridge restarts, Droid hooks will re-register
    """
    
    def __init__(self):
        self._sessions: Dict[str, Session] = {}
        self._lock = Lock()
    
    def register(
        self,
        session_id: str,
        project_dir: str,
        name: Optional[str] = None
    ) -> Session:
        """Register or update a session"""
        import os
        
        with self._lock:
            now = datetime.utcnow()
            
            if not name:
                name = os.path.basename(project_dir) or "unknown"
            
            if session_id in self._sessions:
                # Update existing session
                session = self._sessions[session_id]
                session.last_activity = now
                session.name = name
                session.project_dir = project_dir
                logger.info(f"Updated session: {session_id} ({name})")
            else:
                # Create new session
                session = Session(
                    id=session_id,
                    name=name,
                    project_dir=project_dir,
                    started_at=now,
                    last_activity=now
                )
                self._sessions[session_id] = session
                logger.info(f"Registered new session: {session_id} ({name})")
            
            return session
    
    def get(self, session_id: str) -> Optional[Session]:
        """Get a session by ID"""
        with self._lock:
            return self._sessions.get(session_id)
    
    def get_by_name(self, name: str) -> Optional[Session]:
        """Get a session by name"""
        with self._lock:
            for session in self._sessions.values():
                if session.name.lower() == name.lower():
                    return session
            return None
    
    def get_by_index(self, index: int) -> Optional[Session]:
        """Get a session by its index (1-based)"""
        with self._lock:
            sessions = list(self._sessions.values())
            if 1 <= index <= len(sessions):
                return sessions[index - 1]
            return None
    
    def get_all(self) -> List[Session]:
        """Get all sessions"""
        with self._lock:
            return list(self._sessions.values())
    
    def get_active_sessions(self) -> List[Session]:
        """Get all non-stopped sessions"""
        with self._lock:
            return [s for s in self._sessions.values() if s.status != SessionStatus.STOPPED]
    
    def get_waiting_sessions(self) -> List[Session]:
        """Get all waiting sessions"""
        with self._lock:
            return [s for s in self._sessions.values() if s.status == SessionStatus.WAITING]
    
    def update(self, session_id: str, **kwargs) -> Optional[Session]:
        """Update session attributes"""
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None
            
            for key, value in kwargs.items():
                if hasattr(session, key):
                    setattr(session, key, value)
            
            session.last_activity = datetime.utcnow()
            return session
    
    def update_status(self, session_id: str, status: SessionStatus) -> Optional[Session]:
        """Update session status"""
        return self.update(session_id, status=status)
    
    def set_pending_request(
        self,
        session_id: str,
        pending_request: Optional[PendingRequest]
    ) -> Optional[Session]:
        """Set or clear the pending request for a session"""
        return self.update(session_id, pending_request=pending_request)
    
    def remove(self, session_id: str) -> bool:
        """Remove a session"""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                logger.info(f"Removed session: {session_id}")
                return True
            return False
    
    def clear_stale_sessions(self, max_age_seconds: int = 3600):
        """Remove sessions that haven't been active for a while"""
        with self._lock:
            now = datetime.utcnow()
            stale_ids = []
            
            for session_id, session in self._sessions.items():
                age = (now - session.last_activity).total_seconds()
                if age > max_age_seconds and session.status == SessionStatus.STOPPED:
                    stale_ids.append(session_id)
            
            for session_id in stale_ids:
                del self._sessions[session_id]
                logger.info(f"Cleared stale session: {session_id}")


# Global instance
session_registry = SessionRegistry()
