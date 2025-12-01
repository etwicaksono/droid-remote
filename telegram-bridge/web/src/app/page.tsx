'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SessionCard } from '@/components/sessions/session-card'
import { TaskForm } from '@/components/sessions/task-form'
import { TaskHistory } from '@/components/sessions/task-history'
import { PermissionHistory } from '@/components/sessions/permission-history'
import { ConnectionStatus } from '@/components/connection-status'
import type { Session } from '@/types'

type View = 'session' | 'new' | 'permissions' | 'history'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [currentView, setCurrentView] = useState<View>('session')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [initialUrlProcessed, setInitialUrlProcessed] = useState(false)

  // Read session ID from URL on mount
  useEffect(() => {
    const sessionFromUrl = searchParams.get('session')
    if (sessionFromUrl && !initialUrlProcessed) {
      setSelectedSessionId(sessionFromUrl)
      setCurrentView('session')
      setInitialUrlProcessed(true)
    }
  }, [searchParams, initialUrlProcessed])

  // Update URL when session changes
  const updateUrl = useCallback((sessionId: string | null) => {
    if (sessionId) {
      router.replace(`/?session=${sessionId}`, { scroll: false })
    } else {
      router.replace('/', { scroll: false })
    }
  }, [router])

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch(`${API_BASE}/sessions`)
        if (response.ok) {
          const fetchedSessions: Session[] = await response.json()
          // Sort by last_activity (most recent first)
          const sortedSessions = fetchedSessions.sort((a, b) => {
            const dateA = new Date(a.last_activity).getTime()
            const dateB = new Date(b.last_activity).getTime()
            return dateB - dateA // Descending order (newest first)
          })
          setSessions(sortedSessions)
          
          // Auto-select first session if none selected and no URL param
          const sessionFromUrl = searchParams.get('session')
          if (!selectedSessionId && !sessionFromUrl && sortedSessions.length > 0 && sortedSessions[0]) {
            setSelectedSessionId(sortedSessions[0].id)
            updateUrl(sortedSessions[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
      }
    }

    fetchSessions()
    const interval = setInterval(fetchSessions, 5000) // Refresh every 5s

    return () => clearInterval(interval)
  }, [selectedSessionId, searchParams, updateUrl])

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setCurrentView('session')
    updateUrl(sessionId)
  }

  const handleSelectView = (view: 'new' | 'permissions' | 'history') => {
    setCurrentView(view)
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId)

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* Sidebar */}
      <AppSidebar
        selectedSessionId={selectedSessionId}
        onSelectSession={handleSelectSession}
        onSelectView={handleSelectView}
        currentView={currentView}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pl-0 md:pl-0">
        {/* Header */}
        <header className="flex items-center justify-between p-4 pl-16 md:pl-4 border-b border-gray-800">
          <div>
            <h1 className="text-lg font-semibold">
              {currentView === 'session' && selectedSession
                ? selectedSession.name || selectedSession.project_dir?.split('/').pop() || 'Session'
                : currentView === 'new'
                ? 'Create New Task'
                : currentView === 'permissions'
                ? 'Permission Requests'
                : 'Task History'}
            </h1>
          </div>
          <ConnectionStatus />
        </header>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col p-4 min-h-0">
            {currentView === 'session' && selectedSession && (
              <Suspense fallback={<SessionSkeleton />}>
                <div className="flex-1 flex flex-col min-h-0">
                  <SessionCard session={selectedSession} />
                </div>
              </Suspense>
            )}

            {currentView === 'session' && !selectedSession && (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-lg mb-2">No session selected</p>
                  <p className="text-sm">Select a session from the sidebar or create a new one</p>
                </div>
              </div>
            )}

            {currentView === 'new' && <TaskForm />}

            {currentView === 'permissions' && <PermissionHistory />}

            {currentView === 'history' && <TaskHistory />}
          </div>
        </div>
      </main>
    </div>
  )
}

function SessionSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-gray-800" />
}

// Wrap in Suspense for useSearchParams
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
