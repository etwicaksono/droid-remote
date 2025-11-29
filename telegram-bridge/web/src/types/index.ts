export type SessionStatus = 'running' | 'waiting' | 'stopped'

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
  started_at: string
  last_activity: string
  pending_request: PendingRequest | null
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
