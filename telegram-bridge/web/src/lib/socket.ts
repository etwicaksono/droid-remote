'use client'

import { io, type Socket } from 'socket.io-client'
import type { Session, Notification } from '@/types'

interface ServerToClientEvents {
  sessions_update: (sessions: Session[]) => void
  notification: (notification: Notification) => void
  session_status: (data: { sessionId: string; status: string }) => void
  response_delivered: (data: { sessionId: string; requestId: string }) => void
}

interface ClientToServerEvents {
  subscribe: (data: { sessionId: string }) => void
  unsubscribe: (data: { sessionId: string }) => void
  respond: (data: { sessionId: string; requestId: string; response: string }) => void
  approve: (data: { sessionId: string; requestId: string }) => void
  deny: (data: { sessionId: string; requestId: string }) => void
  get_sessions: () => void
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: TypedSocket | null = null

export function getSocket(): TypedSocket {
  if (!socket) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:8765'

    socket = io(wsUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
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
