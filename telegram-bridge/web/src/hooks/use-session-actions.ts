'use client'

import { useCallback } from 'react'
import { getSocket } from '@/lib/socket'

interface RespondParams {
  sessionId: string
  requestId?: string
  response: string
}

interface ApproveParams {
  sessionId: string
  requestId?: string
}

export function useSessionActions() {
  const socket = getSocket()

  const respond = useCallback(
    ({ sessionId, response }: RespondParams) => {
      // Don't pass requestId - let server deliver to any pending wait for this session
      socket.emit('respond', { sessionId, response })
    },
    [socket]
  )

  const approve = useCallback(
    ({ sessionId }: ApproveParams) => {
      socket.emit('approve', { sessionId })
    },
    [socket]
  )

  const deny = useCallback(
    ({ sessionId }: ApproveParams) => {
      socket.emit('deny', { sessionId })
    },
    [socket]
  )

  return { respond, approve, deny }
}
