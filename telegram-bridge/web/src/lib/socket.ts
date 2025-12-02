'use client'

import { io, type Socket } from 'socket.io-client'
import type { Session, Notification } from '@/types'

interface ServerToClientEvents {
  sessions_update: (sessions: Session[]) => void
  notification: (notification: Notification) => void
  session_status: (data: { sessionId: string; status: string }) => void
  response_delivered: (data: { sessionId: string; requestId: string }) => void
  task_started: (data: { task_id: string; project_dir: string; prompt: string; session_id?: string }) => void
  task_completed: (data: { task_id: string; success: boolean; result: string; session_id?: string }) => void
  task_cancelled: (data: { task_id: string }) => void
  chat_updated: (data: { session_id: string; message: any }) => void
  cli_thinking: (data: { session_id: string; prompt: string }) => void
  cli_thinking_done: (data: { session_id: string }) => void
  task_activity: (data: { task_id: string; session_id: string; activity: { type: string; tool?: string; details?: string; raw: string } }) => void
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
      autoConnect: true,  // Auto-connect when socket is created
      reconnection: true,
      reconnectionAttempts: Infinity,  // Keep trying to reconnect
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],  // Prefer websocket
    })
  }

  // Ensure socket is connected
  if (!socket.connected) {
    socket.connect()
  }

  return socket
}

export function connectSocket(): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = getSocket()

    if (sock.connected) {
      resolve()
      return
    }

    const onConnect = () => {
      sock.off('connect', onConnect)
      sock.off('connect_error', onError)
      resolve()
    }

    const onError = (error: Error) => {
      sock.off('connect', onConnect)
      sock.off('connect_error', onError)
      reject(error)
    }

    sock.on('connect', onConnect)
    sock.on('connect_error', onError)
    sock.connect()
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
