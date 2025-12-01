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
    async ({ sessionId }: SessionIdParam): Promise<{ success: boolean; error?: string }> => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/sessions/${sessionId}/handoff`, {
          method: 'POST',
        })
        const data = await res.json()
        if (!res.ok) {
          return { success: false, error: data.detail || data.error || 'Handoff failed' }
        }
        return { success: true, ...data }
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
      taskId?: string
      sessionId?: string
      model?: string
      reasoningEffort?: string
    }) => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/tasks/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: params.prompt,
            project_dir: params.projectDir,
            task_id: params.taskId,
            session_id: params.sessionId,
            model: params.model,
            reasoning_effort: params.reasoningEffort,
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

  const cancelTask = useCallback(
    async (taskId: string) => {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/cancel`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to cancel task')
      return await res.json()
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

  const getChatHistory = useCallback(
    async (sessionId: string) => {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/chat`)
      if (!res.ok) throw new Error('Failed to get chat history')
      return await res.json()
    },
    []
  )

  const addChatMessage = useCallback(
    async (params: {
      sessionId: string
      type: 'user' | 'assistant'
      content: string
      status?: 'success' | 'error'
      durationMs?: number
      numTurns?: number
    }) => {
      const searchParams = new URLSearchParams({
        msg_type: params.type,
        content: params.content,
      })
      if (params.status) searchParams.append('status', params.status)
      if (params.durationMs) searchParams.append('duration_ms', String(params.durationMs))
      if (params.numTurns) searchParams.append('num_turns', String(params.numTurns))
      
      const res = await fetch(`${API_BASE}/sessions/${params.sessionId}/chat?${searchParams}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to add chat message')
      return await res.json()
    },
    []
  )

  const getSettings = useCallback(
    async (sessionId: string) => {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/settings`)
      if (!res.ok) throw new Error('Failed to get settings')
      return await res.json()
    },
    []
  )

  const updateSettings = useCallback(
    async (params: { sessionId: string; model?: string; reasoningEffort?: string }) => {
      const searchParams = new URLSearchParams()
      if (params.model) searchParams.append('model', params.model)
      if (params.reasoningEffort) searchParams.append('reasoning_effort', params.reasoningEffort)
      
      const res = await fetch(`${API_BASE}/sessions/${params.sessionId}/settings?${searchParams}`, {
        method: 'PUT',
      })
      if (!res.ok) throw new Error('Failed to update settings')
      return await res.json()
    },
    []
  )

  const deleteSession = useCallback(
    async (sessionId: string) => {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete session')
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
    cancelTask,
    getQueue,
    addToQueue,
    clearQueue,
    getChatHistory,
    addChatMessage,
    getSettings,
    updateSettings,
    deleteSession,
    loading,
  }
}
