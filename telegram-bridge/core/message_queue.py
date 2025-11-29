"""
Message Queue - Handles async response queues per session
"""
import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class PendingWait:
    """Represents a pending wait for response"""
    request_id: str
    session_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    future: asyncio.Future = field(default_factory=lambda: asyncio.get_event_loop().create_future())


class MessageQueue:
    """
    Manages async response queues for each session.
    Each session can have multiple pending requests waiting for responses.
    """
    
    def __init__(self):
        self._pending_waits: Dict[str, Dict[str, PendingWait]] = {}  # session_id -> {request_id -> PendingWait}
        self._responses: Dict[str, Dict[str, str]] = {}  # session_id -> {request_id -> response}
    
    async def wait_for_response(
        self,
        session_id: str,
        request_id: str,
        timeout: int = 300
    ) -> Optional[str]:
        """
        Wait for a response for the given request.
        Returns None if timeout occurs.
        """
        # Check if response already exists
        if session_id in self._responses and request_id in self._responses[session_id]:
            response = self._responses[session_id].pop(request_id)
            if not self._responses[session_id]:
                del self._responses[session_id]
            return response
        
        # Create pending wait
        if session_id not in self._pending_waits:
            self._pending_waits[session_id] = {}
        
        # Get or create event loop
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        pending = PendingWait(
            request_id=request_id,
            session_id=session_id,
            future=loop.create_future()
        )
        self._pending_waits[session_id][request_id] = pending
        
        try:
            response = await asyncio.wait_for(pending.future, timeout=timeout)
            logger.info(f"Received response for session {session_id}, request {request_id}")
            return response
        except asyncio.TimeoutError:
            logger.warning(f"Timeout waiting for response: session {session_id}, request {request_id}")
            return None
        finally:
            # Cleanup
            if session_id in self._pending_waits:
                self._pending_waits[session_id].pop(request_id, None)
                if not self._pending_waits[session_id]:
                    del self._pending_waits[session_id]
    
    def deliver_response(
        self,
        session_id: str,
        request_id: Optional[str],
        response: str
    ) -> bool:
        """
        Deliver a response for a pending request.
        If request_id is None, delivers to the most recent pending request.
        Returns True if delivered, False if no pending request found.
        """
        # Find the pending wait
        if session_id in self._pending_waits:
            pending_waits = self._pending_waits[session_id]
            
            if request_id and request_id in pending_waits:
                # Specific request
                pending = pending_waits[request_id]
            elif pending_waits:
                # Most recent (any) pending request for this session
                request_id = next(iter(pending_waits))
                pending = pending_waits[request_id]
            else:
                pending = None
            
            if pending and not pending.future.done():
                pending.future.set_result(response)
                logger.info(f"Delivered response to session {session_id}, request {request_id}")
                return True
        
        # Store for later retrieval if no pending wait
        if session_id not in self._responses:
            self._responses[session_id] = {}
        
        if request_id:
            self._responses[session_id][request_id] = response
        else:
            # Use a generic key if no request_id
            self._responses[session_id]["_latest"] = response
        
        logger.info(f"Stored response for later: session {session_id}")
        return True
    
    def get_pending_response(
        self,
        session_id: str,
        request_id: str
    ) -> Optional[str]:
        """Get a stored response without blocking"""
        if session_id in self._responses:
            return self._responses[session_id].pop(request_id, None)
        return None
    
    def has_pending_waits(self, session_id: str) -> bool:
        """Check if session has any pending waits"""
        return bool(self._pending_waits.get(session_id))
    
    def cancel_all_waits(self, session_id: str):
        """Cancel all pending waits for a session"""
        if session_id in self._pending_waits:
            for pending in self._pending_waits[session_id].values():
                if not pending.future.done():
                    pending.future.cancel()
            del self._pending_waits[session_id]
            logger.info(f"Cancelled all waits for session {session_id}")


# Global instance
message_queue = MessageQueue()
