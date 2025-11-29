'use client'

import { useCallback } from 'react'
import { getSocket } from '@/lib/socket'

interface RespondParams {
  sessionId: string
  requestId: string
  response: string
}

interface ApproveParams {
  sessionId: string
  requestId: string
}

export function useSessionActions() {
  const socket = getSocket()

  const respond = useCallback(
    ({ sessionId, requestId, response }: RespondParams) => {
      socket.emit('respond', { sessionId, requestId, response })
    },
    [socket]
  )

  const approve = useCallback(
    ({ sessionId, requestId }: ApproveParams) => {
      socket.emit('approve', { sessionId, requestId })
    },
    [socket]
  )

  const deny = useCallback(
    ({ sessionId, requestId }: ApproveParams) => {
      socket.emit('deny', { sessionId, requestId })
    },
    [socket]
  )

  return { respond, approve, deny }
}
