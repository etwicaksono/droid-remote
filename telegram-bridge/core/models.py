"""
Pydantic models for the bridge server
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class SessionStatus(str, Enum):
    RUNNING = "running"
    WAITING = "waiting"
    STOPPED = "stopped"


class ControlState(str, Enum):
    """Who has control of the session"""
    CLI_ACTIVE = "cli_active"      # CLI is running and processing
    CLI_WAITING = "cli_waiting"    # CLI at stop point, waiting for input
    REMOTE_ACTIVE = "remote_active"  # Remote (Telegram/Web) has control
    RELEASED = "released"          # Released, waiting for CLI to resume


class NotificationType(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"
    PERMISSION = "permission"
    STOP = "stop"
    START = "start"


class Button(BaseModel):
    text: str
    callback: str


class PendingRequest(BaseModel):
    id: str
    type: NotificationType
    message: str
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    buttons: List[Button] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    telegram_message_id: Optional[int] = None


class Session(BaseModel):
    id: str
    name: str
    project_dir: str
    status: SessionStatus = SessionStatus.RUNNING
    control_state: ControlState = ControlState.CLI_ACTIVE
    started_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    pending_request: Optional[PendingRequest] = None
    transcript_path: Optional[str] = None

    class Config:
        use_enum_values = True
    
    @property
    def is_remote_controlled(self) -> bool:
        """Check if session is under remote control"""
        return self.control_state == ControlState.REMOTE_ACTIVE
    
    @property
    def can_accept_remote_input(self) -> bool:
        """Check if session can accept remote input"""
        return self.control_state == ControlState.REMOTE_ACTIVE


class Notification(BaseModel):
    session_id: str
    session_name: str
    message: str
    type: NotificationType = NotificationType.INFO
    buttons: List[Button] = Field(default_factory=list)


# API Request/Response Models

class RegisterSessionRequest(BaseModel):
    session_id: str
    project_dir: str
    session_name: Optional[str] = None


class UpdateSessionRequest(BaseModel):
    status: Optional[SessionStatus] = None
    pending_request: Optional[PendingRequest] = None


class NotifyRequest(BaseModel):
    session_name: str
    message: str
    type: NotificationType = NotificationType.INFO
    buttons: List[Button] = Field(default_factory=list)
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None


class WaitRequest(BaseModel):
    request_id: str
    timeout: int = 300


class WaitResponse(BaseModel):
    response: Optional[str] = None
    timeout: bool = False
    has_response: bool = False


class RespondRequest(BaseModel):
    request_id: Optional[str] = None
    response: str


class HealthResponse(BaseModel):
    status: str = "healthy"
    active_sessions: int = 0
    bot_connected: bool = False
    version: str = "1.0.0"


# Task Execution Models (droid exec)

class TaskExecuteRequest(BaseModel):
    prompt: str
    project_dir: str
    task_id: Optional[str] = None  # Optional task ID for cancellation tracking
    session_id: Optional[str] = None  # For continuing sessions
    autonomy_level: str = "high"  # low, medium, high
    model: Optional[str] = None  # Model ID (e.g., claude-sonnet-4-20250514)
    reasoning_effort: Optional[str] = None  # off, low, medium, high (for models with thinking)
    images: Optional[List[str]] = None  # Image URLs referenced as @1, @2 in prompt
    streaming: bool = False  # Use stream-json format


class TaskResponse(BaseModel):
    success: bool
    result: Optional[str] = None  # None when status is "pending"
    task_id: str
    session_id: Optional[str] = None
    duration_ms: int = 0
    num_turns: int = 0
    error: Optional[str] = None
    status: str = "completed"  # "pending", "running", "completed", "failed"
