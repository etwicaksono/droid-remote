export type SessionStatus = 'running' | 'waiting' | 'stopped'
export type ControlState = 'cli_active' | 'cli_waiting' | 'remote_active' | 'released'

export interface PendingRequest {
  id: string
  type: 'info' | 'warning' | 'error' | 'permission' | 'stop' | 'start'
  message: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  created_at: string
}

export interface Session {
  id: string
  name: string
  project_dir: string
  status: SessionStatus
  control_state?: ControlState
  started_at: string
  last_activity: string
  pending_request: PendingRequest | null
  transcript_path?: string
}

export interface QueuedMessage {
  id: number
  session_id: string
  content: string
  source: 'telegram' | 'web'
  status: 'pending' | 'sent' | 'cancelled'
  created_at: string
  sent_at?: string
}

export interface PermissionRequest {
  id: string
  session_id: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  message: string
  decision?: 'approved' | 'denied' | 'pending'
  decided_by?: 'telegram' | 'web' | 'auto'
  created_at: string
  decided_at?: string
}

export interface Task {
  id: string
  session_id?: string
  prompt: string
  project_dir: string
  model?: string
  result?: string
  success?: boolean
  duration_ms?: number
  num_turns?: number
  error?: string
  source: 'telegram' | 'web' | 'api'
  created_at: string
  completed_at?: string
}

export interface SessionEvent {
  id: number
  session_id: string
  event_type: string
  event_data?: Record<string, unknown>
  created_at: string
}

export interface Notification {
  session_id: string
  session_name: string
  message: string
  type: string
  request_id?: string
}

export interface HealthStatus {
  status: string
  active_sessions: number
  bot_connected: boolean
  version: string
}

export interface TaskExecuteRequest {
  prompt: string
  project_dir: string
  session_id?: string
  autonomy_level?: string
  model?: string
}

export interface TaskResponse {
  success: boolean
  result: string
  task_id: string
  session_id?: string
  duration_ms: number
  num_turns: number
  error?: string
}
