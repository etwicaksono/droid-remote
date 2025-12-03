'use client'

import { io, type Socket } from 'socket.io-client'
import type { Session, Notification } from '@/types'

interface ActivityEvent {
  type: 'message' | 'tool_call' | 'tool_result' | 'raw'
  role?: string
  text?: string
  toolName?: string
  parameters?: Record<string, unknown>
  value?: string
  isError?: boolean
}

interface ServerToClientEvents {
  sessions_update: (sessions: Session[]) => void
  notification: (notification: Notification) => void
  session_status: (data: { sessionId: string; status: string }) => void
  response_delivered: (data: { sessionId: string; requestId: string }) => void
  task_started: (data: { task_id: string; project_dir: string; prompt: string; session_id?: string }) => void
  task_activity: (data: { task_id: string; session_id?: string; event: ActivityEvent }) => void
  task_completed: (data: { task_id: string; success: boolean; result: string; session_id?: string }) => void
  task_cancelled: (data: { task_id: string }) => void
  chat_updated: (data: { session_id: string; message: any }) => void
  cli_thinking: (data: { session_id: string; prompt: string }) => void
  cli_thinking_done: (data: { session_id: string }) => void
}

interface ClientToServerEvents {
  subscribe: (data: { sessionId: string }) => void
  unsubscribe: (data: { sessionId: string }) => void
  respond: (data: { sessionId: string; requestId?: string; response: string }) => void
  approve: (data: { sessionId: string; requestId?: string }) => void
  deny: (data: { sessionId: string; requestId?: string }) => void
  get_sessions: () => void
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: TypedSocket | null = null

export function getSocket(): TypedSocket {
  if (!socket) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:8765'

    socket = io(wsUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    })
    
    // Log connection events for debugging
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket?.id)
    })
    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })
    socket.on('connect_error', (error) => {
      console.log('[Socket] Connection error:', error.message)
    })
  }

  return socket
}

export function connectSocket(): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = getSocket()

    // Already connected or connecting
    if (sock.connected) {
      resolve()
      return
    }

    // Socket auto-connects, just wait for it
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'))
    }, 10000)

    const onConnect = () => {
      clearTimeout(timeout)
      sock.off('connect', onConnect)
      sock.off('connect_error', onError)
      resolve()
    }

    const onError = (error: Error) => {
      clearTimeout(timeout)
      sock.off('connect', onConnect)
      sock.off('connect_error', onError)
      reject(error)
    }

    sock.once('connect', onConnect)
    sock.once('connect_error', onError)
  })
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
  }
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false
}
