"""
Repository classes for database operations
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from .database import get_db, row_to_dict, json_serialize, json_deserialize


class SessionRepository:
    """Repository for sessions table"""
    
    def create(
        self,
        session_id: str,
        name: str,
        project_dir: str,
        status: str = "running",
        control_state: str = "cli_active",
        transcript_path: Optional[str] = None
    ) -> dict:
        """Create a new session"""
        db = get_db()
        now = datetime.utcnow()
        
        db.execute("""
            INSERT INTO sessions (id, name, project_dir, status, control_state, transcript_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (session_id, name, project_dir, status, control_state, transcript_path, now, now))
        db.commit()
        
        # Log event
        SessionEventRepository().create(session_id, "session_created", {
            "name": name,
            "project_dir": project_dir,
            "control_state": control_state
        })
        
        return self.get_by_id(session_id)
    
    def get_by_id(self, session_id: str) -> Optional[dict]:
        """Get session by ID"""
        db = get_db()
        cursor = db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        return row_to_dict(row) if row else None
    
    def get_by_project_dir(self, project_dir: str) -> Optional[dict]:
        """Get session by project directory"""
        db = get_db()
        cursor = db.execute(
            "SELECT * FROM sessions WHERE project_dir = ? ORDER BY updated_at DESC LIMIT 1",
            (project_dir,)
        )
        row = cursor.fetchone()
        return row_to_dict(row) if row else None
    
    def get_all(self, include_stopped: bool = False) -> List[dict]:
        """Get all sessions"""
        db = get_db()
        if include_stopped:
            cursor = db.execute("SELECT * FROM sessions ORDER BY updated_at DESC")
        else:
            cursor = db.execute(
                "SELECT * FROM sessions WHERE status != 'stopped' ORDER BY updated_at DESC"
            )
        return [row_to_dict(row) for row in cursor.fetchall()]
    
    def update(self, session_id: str, **kwargs) -> Optional[dict]:
        """Update session fields"""
        if not kwargs:
            return self.get_by_id(session_id)
        
        db = get_db()
        kwargs['updated_at'] = datetime.utcnow()
        
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [session_id]
        
        db.execute(f"UPDATE sessions SET {fields} WHERE id = ?", tuple(values))
        db.commit()
        
        return self.get_by_id(session_id)
    
    def update_status(self, session_id: str, status: str) -> Optional[dict]:
        """Update session status"""
        result = self.update(session_id, status=status)
        if result:
            SessionEventRepository().create(session_id, "status_changed", {"status": status})
        return result
    
    def update_control_state(self, session_id: str, control_state: str) -> Optional[dict]:
        """Update session control state"""
        result = self.update(session_id, control_state=control_state)
        if result:
            SessionEventRepository().create(session_id, "control_state_changed", {"control_state": control_state})
        return result
    
    def delete(self, session_id: str) -> bool:
        """Delete a session"""
        db = get_db()
        cursor = db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        db.commit()
        return cursor.rowcount > 0
    
    def upsert(
        self,
        session_id: str,
        name: str,
        project_dir: str,
        **kwargs
    ) -> dict:
        """Create or update session"""
        existing = self.get_by_id(session_id)
        if existing:
            return self.update(session_id, name=name, project_dir=project_dir, **kwargs)
        return self.create(session_id, name, project_dir, **kwargs)


class SessionEventRepository:
    """Repository for session_events table"""
    
    def create(self, session_id: str, event_type: str, event_data: Optional[dict] = None) -> dict:
        """Create a new session event"""
        db = get_db()
        now = datetime.utcnow()
        data_json = json_serialize(event_data) if event_data else None
        
        cursor = db.execute("""
            INSERT INTO session_events (session_id, event_type, event_data, created_at)
            VALUES (?, ?, ?, ?)
        """, (session_id, event_type, data_json, now))
        db.commit()
        
        return {"id": cursor.lastrowid, "session_id": session_id, "event_type": event_type, "created_at": now}
    
    def get_by_session(self, session_id: str, limit: int = 100) -> List[dict]:
        """Get events for a session"""
        db = get_db()
        cursor = db.execute("""
            SELECT * FROM session_events 
            WHERE session_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        """, (session_id, limit))
        
        events = []
        for row in cursor.fetchall():
            event = row_to_dict(row)
            event['event_data'] = json_deserialize(event.get('event_data'))
            events.append(event)
        return events
    
    def get_timeline(self, session_id: str, limit: int = 50) -> List[dict]:
        """Get unified timeline for a session (events, permissions, tasks)"""
        db = get_db()
        cursor = db.execute("""
            SELECT 'event' as type, event_type as action, event_data as data, created_at
            FROM session_events WHERE session_id = ?
            UNION ALL
            SELECT 'permission' as type, tool_name as action, 
                   json_object('decision', decision, 'decided_by', decided_by) as data, created_at
            FROM permission_requests WHERE session_id = ?
            UNION ALL
            SELECT 'task' as type, substr(prompt, 1, 50) as action,
                   json_object('success', success, 'duration_ms', duration_ms) as data, created_at
            FROM tasks WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (session_id, session_id, session_id, limit))
        
        return [row_to_dict(row) for row in cursor.fetchall()]


class QueuedMessageRepository:
    """Repository for queued_messages table"""
    
    def create(self, session_id: str, content: str, source: str) -> dict:
        """Create a new queued message"""
        db = get_db()
        now = datetime.utcnow()
        
        cursor = db.execute("""
            INSERT INTO queued_messages (session_id, content, source, status, created_at)
            VALUES (?, ?, ?, 'pending', ?)
        """, (session_id, content, source, now))
        db.commit()
        
        return {
            "id": cursor.lastrowid,
            "session_id": session_id,
            "content": content,
            "source": source,
            "status": "pending",
            "created_at": now
        }
    
    def get_pending(self, session_id: str) -> List[dict]:
        """Get pending messages for a session"""
        db = get_db()
        cursor = db.execute("""
            SELECT * FROM queued_messages 
            WHERE session_id = ? AND status = 'pending'
            ORDER BY created_at ASC
        """, (session_id,))
        return [row_to_dict(row) for row in cursor.fetchall()]
    
    def get_next(self, session_id: str) -> Optional[dict]:
        """Get next pending message"""
        db = get_db()
        cursor = db.execute("""
            SELECT * FROM queued_messages 
            WHERE session_id = ? AND status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
        """, (session_id,))
        row = cursor.fetchone()
        return row_to_dict(row) if row else None
    
    def mark_sent(self, message_id: int) -> bool:
        """Mark message as sent"""
        db = get_db()
        now = datetime.utcnow()
        cursor = db.execute("""
            UPDATE queued_messages SET status = 'sent', sent_at = ? WHERE id = ?
        """, (now, message_id))
        db.commit()
        return cursor.rowcount > 0
    
    def cancel(self, message_id: int) -> bool:
        """Cancel a queued message"""
        db = get_db()
        cursor = db.execute("""
            UPDATE queued_messages SET status = 'cancelled' WHERE id = ? AND status = 'pending'
        """, (message_id,))
        db.commit()
        return cursor.rowcount > 0
    
    def clear_pending(self, session_id: str) -> int:
        """Clear all pending messages for a session"""
        db = get_db()
        cursor = db.execute("""
            UPDATE queued_messages SET status = 'cancelled' WHERE session_id = ? AND status = 'pending'
        """, (session_id,))
        db.commit()
        return cursor.rowcount
    
    def count_pending(self, session_id: str) -> int:
        """Count pending messages"""
        db = get_db()
        cursor = db.execute("""
            SELECT COUNT(*) FROM queued_messages WHERE session_id = ? AND status = 'pending'
        """, (session_id,))
        return cursor.fetchone()[0]


class PermissionRequestRepository:
    """Repository for permission_requests table"""
    
    def create(
        self,
        session_id: str,
        message: str,
        tool_name: Optional[str] = None,
        tool_input: Optional[dict] = None,
        request_id: Optional[str] = None,
        telegram_message_id: Optional[int] = None
    ) -> dict:
        """Create a new permission request"""
        db = get_db()
        now = datetime.utcnow()
        request_id = request_id or str(uuid.uuid4())
        tool_input_json = json_serialize(tool_input) if tool_input else None
        
        db.execute("""
            INSERT INTO permission_requests 
            (id, session_id, tool_name, tool_input, message, telegram_message_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (request_id, session_id, tool_name, tool_input_json, message, telegram_message_id, now))
        db.commit()
        
        return {
            "id": request_id,
            "session_id": session_id,
            "tool_name": tool_name,
            "tool_input": tool_input,
            "message": message,
            "decision": "pending",
            "telegram_message_id": telegram_message_id,
            "created_at": now
        }
    
    def get_by_id(self, request_id: str) -> Optional[dict]:
        """Get permission request by ID"""
        db = get_db()
        cursor = db.execute("SELECT * FROM permission_requests WHERE id = ?", (request_id,))
        row = cursor.fetchone()
        if row:
            result = row_to_dict(row)
            result['tool_input'] = json_deserialize(result.get('tool_input'))
            return result
        return None
    
    def get_pending_by_session(self, session_id: str) -> Optional[dict]:
        """Get pending permission request for a session"""
        db = get_db()
        cursor = db.execute("""
            SELECT * FROM permission_requests 
            WHERE session_id = ? AND decision = 'pending'
            ORDER BY created_at DESC LIMIT 1
        """, (session_id,))
        row = cursor.fetchone()
        if row:
            result = row_to_dict(row)
            result['tool_input'] = json_deserialize(result.get('tool_input'))
            return result
        return None
    
    def resolve(self, request_id: str, decision: str, decided_by: str) -> Optional[dict]:
        """Resolve a permission request"""
        db = get_db()
        now = datetime.utcnow()
        
        db.execute("""
            UPDATE permission_requests 
            SET decision = ?, decided_by = ?, decided_at = ?
            WHERE id = ?
        """, (decision, decided_by, now, request_id))
        db.commit()
        
        # Log event
        request = self.get_by_id(request_id)
        if request:
            SessionEventRepository().create(request['session_id'], "permission_resolved", {
                "request_id": request_id,
                "decision": decision,
                "decided_by": decided_by,
                "tool_name": request.get('tool_name')
            })
        
        return request
    
    def update_telegram_message_id(self, request_id: str, telegram_message_id: int) -> bool:
        """Update telegram message ID for a request"""
        db = get_db()
        cursor = db.execute("""
            UPDATE permission_requests SET telegram_message_id = ? WHERE id = ?
        """, (telegram_message_id, request_id))
        db.commit()
        return cursor.rowcount > 0
    
    def get_history(self, session_id: Optional[str] = None, limit: int = 50) -> List[dict]:
        """Get permission request history"""
        db = get_db()
        if session_id:
            cursor = db.execute("""
                SELECT * FROM permission_requests 
                WHERE session_id = ?
                ORDER BY created_at DESC LIMIT ?
            """, (session_id, limit))
        else:
            cursor = db.execute("""
                SELECT * FROM permission_requests 
                ORDER BY created_at DESC LIMIT ?
            """, (limit,))
        
        results = []
        for row in cursor.fetchall():
            result = row_to_dict(row)
            result['tool_input'] = json_deserialize(result.get('tool_input'))
            results.append(result)
        return results


class TaskRepository:
    """Repository for tasks table"""
    
    def create(
        self,
        prompt: str,
        project_dir: str,
        source: str,
        session_id: Optional[str] = None,
        model: Optional[str] = None,
        task_id: Optional[str] = None
    ) -> dict:
        """Create a new task"""
        db = get_db()
        now = datetime.utcnow()
        task_id = task_id or str(uuid.uuid4())
        
        db.execute("""
            INSERT INTO tasks (id, session_id, prompt, project_dir, model, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (task_id, session_id, prompt, project_dir, model, source, now))
        db.commit()
        
        return {
            "id": task_id,
            "session_id": session_id,
            "prompt": prompt,
            "project_dir": project_dir,
            "model": model,
            "source": source,
            "created_at": now
        }
    
    def complete(
        self,
        task_id: str,
        success: bool,
        result: Optional[str] = None,
        duration_ms: int = 0,
        num_turns: int = 0,
        error: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Optional[dict]:
        """Mark task as completed"""
        db = get_db()
        now = datetime.utcnow()
        
        db.execute("""
            UPDATE tasks 
            SET success = ?, result = ?, duration_ms = ?, num_turns = ?, error = ?, 
                completed_at = ?, session_id = COALESCE(?, session_id)
            WHERE id = ?
        """, (success, result, duration_ms, num_turns, error, now, session_id, task_id))
        db.commit()
        
        return self.get_by_id(task_id)
    
    def get_by_id(self, task_id: str) -> Optional[dict]:
        """Get task by ID"""
        db = get_db()
        cursor = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cursor.fetchone()
        return row_to_dict(row) if row else None
    
    def get_history(
        self,
        session_id: Optional[str] = None,
        source: Optional[str] = None,
        success_only: bool = False,
        limit: int = 50
    ) -> List[dict]:
        """Get task history with filters"""
        db = get_db()
        conditions = []
        params = []
        
        if session_id:
            conditions.append("session_id = ?")
            params.append(session_id)
        if source:
            conditions.append("source = ?")
            params.append(source)
        if success_only:
            conditions.append("success = 1")
        
        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(limit)
        
        cursor = db.execute(f"""
            SELECT * FROM tasks 
            {where_clause}
            ORDER BY created_at DESC LIMIT ?
        """, tuple(params))
        
        return [row_to_dict(row) for row in cursor.fetchall()]
    
    def get_failed(self, limit: int = 20) -> List[dict]:
        """Get failed tasks for troubleshooting"""
        db = get_db()
        cursor = db.execute("""
            SELECT * FROM tasks 
            WHERE success = 0 AND completed_at IS NOT NULL
            ORDER BY created_at DESC LIMIT ?
        """, (limit,))
        return [row_to_dict(row) for row in cursor.fetchall()]


class ChatMessageRepository:
    """Repository for chat_messages table"""
    
    def create(
        self,
        session_id: str,
        msg_type: str,  # 'user' or 'assistant'
        content: str,
        status: Optional[str] = None,
        duration_ms: Optional[int] = None,
        num_turns: Optional[int] = None,
        source: str = 'web'  # 'web' or 'cli'
    ) -> dict:
        """Create a new chat message"""
        db = get_db()
        cursor = db.execute("""
            INSERT INTO chat_messages (session_id, type, content, status, duration_ms, num_turns, source)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (session_id, msg_type, content, status, duration_ms, num_turns, source))
        db.commit()
        
        return {
            "id": cursor.lastrowid,
            "session_id": session_id,
            "type": msg_type,
            "content": content,
            "status": status,
            "duration_ms": duration_ms,
            "num_turns": num_turns,
            "source": source,
            "created_at": datetime.utcnow().isoformat()
        }
    
    def get_by_session(self, session_id: str, limit: int = 100) -> List[dict]:
        """Get chat messages for a session"""
        db = get_db()
        cursor = db.execute("""
            SELECT * FROM chat_messages 
            WHERE session_id = ? 
            ORDER BY created_at ASC
            LIMIT ?
        """, (session_id, limit))
        return [row_to_dict(row) for row in cursor.fetchall()]
    
    def clear_session(self, session_id: str) -> int:
        """Clear all chat messages for a session"""
        db = get_db()
        cursor = db.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        db.commit()
        return cursor.rowcount


class SessionSettingsRepository:
    """Repository for session_settings table"""
    
    def get(self, session_id: str) -> Optional[dict]:
        """Get settings for a session"""
        db = get_db()
        cursor = db.execute("SELECT * FROM session_settings WHERE session_id = ?", (session_id,))
        row = cursor.fetchone()
        return row_to_dict(row) if row else None
    
    def upsert(
        self,
        session_id: str,
        model: Optional[str] = None,
        reasoning_effort: Optional[str] = None
    ) -> dict:
        """Create or update settings for a session"""
        db = get_db()
        existing = self.get(session_id)
        now = datetime.utcnow()
        
        if existing:
            # Update existing
            updates = []
            params = []
            if model is not None:
                updates.append("model = ?")
                params.append(model)
            if reasoning_effort is not None:
                updates.append("reasoning_effort = ?")
                params.append(reasoning_effort)
            updates.append("updated_at = ?")
            params.append(now)
            params.append(session_id)
            
            db.execute(f"""
                UPDATE session_settings SET {', '.join(updates)} WHERE session_id = ?
            """, params)
        else:
            # Insert new
            db.execute("""
                INSERT INTO session_settings (session_id, model, reasoning_effort, updated_at)
                VALUES (?, ?, ?, ?)
            """, (
                session_id,
                model or 'claude-sonnet-4-5-20250929',
                reasoning_effort or 'medium',
                now
            ))
        
        db.commit()
        return self.get(session_id)


# Singleton instances
_session_repo: Optional[SessionRepository] = None
_event_repo: Optional[SessionEventRepository] = None
_queue_repo: Optional[QueuedMessageRepository] = None
_permission_repo: Optional[PermissionRequestRepository] = None
_task_repo: Optional[TaskRepository] = None
_chat_repo: Optional[ChatMessageRepository] = None
_settings_repo: Optional[SessionSettingsRepository] = None


def get_session_repo() -> SessionRepository:
    global _session_repo
    if _session_repo is None:
        _session_repo = SessionRepository()
    return _session_repo


def get_event_repo() -> SessionEventRepository:
    global _event_repo
    if _event_repo is None:
        _event_repo = SessionEventRepository()
    return _event_repo


def get_queue_repo() -> QueuedMessageRepository:
    global _queue_repo
    if _queue_repo is None:
        _queue_repo = QueuedMessageRepository()
    return _queue_repo


def get_permission_repo() -> PermissionRequestRepository:
    global _permission_repo
    if _permission_repo is None:
        _permission_repo = PermissionRequestRepository()
    return _permission_repo


def get_task_repo() -> TaskRepository:
    global _task_repo
    if _task_repo is None:
        _task_repo = TaskRepository()
    return _task_repo


def get_chat_repo() -> ChatMessageRepository:
    global _chat_repo
    if _chat_repo is None:
        _chat_repo = ChatMessageRepository()
    return _chat_repo


def get_settings_repo() -> SessionSettingsRepository:
    global _settings_repo
    if _settings_repo is None:
        _settings_repo = SessionSettingsRepository()
    return _settings_repo
