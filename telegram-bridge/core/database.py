"""
SQLite database connection and schema management
"""
import sqlite3
import threading
import json
from pathlib import Path
from typing import Optional, Any
from contextlib import contextmanager
from datetime import datetime

# Default database path
DEFAULT_DB_PATH = Path(__file__).parent.parent / "data" / "bridge.db"

# Schema definition
SCHEMA = """
-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_dir TEXT NOT NULL,
    status TEXT DEFAULT 'running',
    control_state TEXT DEFAULT 'cli_active',
    transcript_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session events (for troubleshooting)
CREATE TABLE IF NOT EXISTS session_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Message queue
CREATE TABLE IF NOT EXISTS queued_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Permission requests
CREATE TABLE IF NOT EXISTS permission_requests (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tool_name TEXT,
    tool_input TEXT,
    message TEXT,
    decision TEXT DEFAULT 'pending',
    decided_by TEXT,
    telegram_message_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Task executions
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    prompt TEXT NOT NULL,
    project_dir TEXT NOT NULL,
    model TEXT,
    result TEXT,
    success BOOLEAN,
    duration_ms INTEGER,
    num_turns INTEGER,
    error TEXT,
    source TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_events_created ON session_events(created_at);
CREATE INDEX IF NOT EXISTS idx_queued_messages_session ON queued_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_queued_messages_status ON queued_messages(status);
CREATE INDEX IF NOT EXISTS idx_permission_requests_session ON permission_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
"""


class Database:
    """Thread-safe SQLite database connection manager"""
    
    _instance: Optional['Database'] = None
    _lock = threading.Lock()
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        self._local = threading.local()
        self._ensure_directory()
        self._init_schema()
    
    @classmethod
    def get_instance(cls, db_path: Optional[Path] = None) -> 'Database':
        """Get singleton instance"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls(db_path)
        return cls._instance
    
    @classmethod
    def reset_instance(cls):
        """Reset singleton (for testing)"""
        with cls._lock:
            if cls._instance is not None:
                cls._instance.close_all()
            cls._instance = None
    
    def _ensure_directory(self):
        """Create database directory if it doesn't exist"""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get thread-local connection"""
        if not hasattr(self._local, 'connection') or self._local.connection is None:
            self._local.connection = sqlite3.connect(
                str(self.db_path),
                check_same_thread=False,
                detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES
            )
            self._local.connection.row_factory = sqlite3.Row
            # Enable foreign keys
            self._local.connection.execute("PRAGMA foreign_keys = ON")
        return self._local.connection
    
    def _init_schema(self):
        """Initialize database schema"""
        conn = self._get_connection()
        conn.executescript(SCHEMA)
        conn.commit()
    
    @contextmanager
    def connection(self):
        """Context manager for database connection"""
        conn = self._get_connection()
        try:
            yield conn
        except Exception:
            conn.rollback()
            raise
    
    @contextmanager
    def transaction(self):
        """Context manager for transactions"""
        conn = self._get_connection()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    
    def execute(self, query: str, params: tuple = ()) -> sqlite3.Cursor:
        """Execute a query"""
        conn = self._get_connection()
        return conn.execute(query, params)
    
    def executemany(self, query: str, params_list: list) -> sqlite3.Cursor:
        """Execute a query with multiple parameter sets"""
        conn = self._get_connection()
        return conn.executemany(query, params_list)
    
    def commit(self):
        """Commit current transaction"""
        conn = self._get_connection()
        conn.commit()
    
    def rollback(self):
        """Rollback current transaction"""
        conn = self._get_connection()
        conn.rollback()
    
    def close_all(self):
        """Close all connections (for shutdown)"""
        if hasattr(self._local, 'connection') and self._local.connection:
            self._local.connection.close()
            self._local.connection = None


def row_to_dict(row: sqlite3.Row) -> dict:
    """Convert sqlite3.Row to dictionary"""
    return dict(zip(row.keys(), row))


def json_serialize(obj: Any) -> str:
    """Serialize object to JSON for storage"""
    return json.dumps(obj, default=str)


def json_deserialize(s: Optional[str]) -> Any:
    """Deserialize JSON string"""
    if s is None:
        return None
    return json.loads(s)


# Global database instance getter
def get_db() -> Database:
    """Get the global database instance"""
    return Database.get_instance()
