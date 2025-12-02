'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { SessionCard } from '@/components/sessions/session-card'
import { PageLayout } from '@/components/layout/page-layout'
import type { Session } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

export default function SessionPage() {
  const params = useParams()
  const sessionId = params.id as string
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Reset state when session changes
    setLoading(true)
    setSession(null)
    
    const fetchSession = async () => {
      try {
        // Fetch single session directly
        const response = await fetch(`${API_BASE}/sessions/${sessionId}`)
        if (response.ok) {
          const sessionData: Session = await response.json()
          setSession(sessionData)
        } else if (response.status === 404) {
          setSession(null)
        }
      } catch (error) {
        console.error('Failed to fetch session:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [sessionId])

  if (loading) {
    return (
      <PageLayout title="Loading..." currentPath={`/session/${sessionId}`}>
        <div className="h-64 animate-pulse rounded-lg bg-gray-800" />
      </PageLayout>
    )
  }

  if (!session) {
    return (
      <PageLayout title="Session Not Found" currentPath={`/session/${sessionId}`}>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg mb-2">Session not found</p>
            <p className="text-sm">The session may have ended or the ID is invalid</p>
          </div>
        </div>
      </PageLayout>
    )
  }

  const title = session.name || session.project_dir?.split('/').pop() || 'Session'

  return (
    <PageLayout title={title} currentPath={`/session/${sessionId}`}>
      <div className="flex-1 flex flex-col min-h-0">
        <SessionCard session={session} />
      </div>
    </PageLayout>
  )
}
