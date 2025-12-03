'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { getSocket } from '@/lib/socket'
import type { Session } from '@/types'

const SESSIONS_QUERY_KEY = ['sessions'] as const

export function useSessions() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async () => {
      return apiClient.get<Session[]>('/sessions')
    },
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const socket = getSocket()

    const handleSessionsUpdate = (sessions: Session[]) => {
      queryClient.setQueryData(SESSIONS_QUERY_KEY, sessions)
    }

    socket.on('sessions_update', handleSessionsUpdate)

    return () => {
      socket.off('sessions_update', handleSessionsUpdate)
    }
  }, [queryClient])

  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
