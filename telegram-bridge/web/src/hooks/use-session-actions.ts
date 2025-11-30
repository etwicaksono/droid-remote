'use client'

import { useCallback, useState } from 'react'
import { getSocket } from '@/lib/socket'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface RespondParams {
  sessionId: string
  requestId?: string
  response: string
}

interface ApproveParams {
  sessionId: string
  requestId?: string
}

interface SessionIdParam {
  sessionId: string
}

export function useSessionActions() {
  const socket = getSocket()
  const [loading, setLoading] = useState(false)

  const respond = useCallback(
    ({ sessionId, response }: RespondParams) => {
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

  const handoff = useCallback(
    async ({ sessionId }: SessionIdParam) => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/sessions/${sessionId}/handoff`, {
          method: 'POST',
        })
        if (!res.ok) throw new Error('Handoff failed')
        return await res.json()
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const release = useCallback(
    async ({ sessionId }: SessionIdParam) => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/sessions/${sessionId}/release`, {
          method: 'POST',
        })
        if (!res.ok) throw new Error('Release failed')
        return await res.json()
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const executeTask = useCallback(
    async (params: {
      prompt: string
      projectDir: string
      sessionId?: string
      model?: string
    }) => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/tasks/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: params.prompt,
            project_dir: params.projectDir,
            session_id: params.sessionId,
            model: params.model,
          }),
        })
        if (!res.ok) throw new Error('Task execution failed')
        return await res.json()
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const getQueue = useCallback(
    async ({ sessionId }: SessionIdParam) => {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/queue`)
      if (!res.ok) throw new Error('Failed to get queue')
      return await res.json()
    },
    []
  )

  const addToQueue = useCallback(
    async ({ sessionId, content }: { sessionId: string; content: string }) => {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/queue?content=${encodeURIComponent(content)}&source=web`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to add to queue')
      return await res.json()
    },
    []
  )

  const clearQueue = useCallback(
    async ({ sessionId }: SessionIdParam) => {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/queue`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to clear queue')
      return await res.json()
    },
    []
  )

  return {
    respond,
    approve,
    deny,
    handoff,
    release,
    executeTask,
    getQueue,
    addToQueue,
    clearQueue,
    loading,
  }
}
