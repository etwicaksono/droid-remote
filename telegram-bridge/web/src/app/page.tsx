'use client'

import { Suspense, useState, useEffect } from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SessionCard } from '@/components/sessions/session-card'
import { TaskForm } from '@/components/sessions/task-form'
import { TaskHistory } from '@/components/sessions/task-history'
import { PermissionHistory } from '@/components/sessions/permission-history'
import { ConnectionStatus } from '@/components/connection-status'
import type { Session } from '@/types'

type View = 'session' | 'new' | 'permissions' | 'history'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

export default function DashboardPage() {
  const [currentView, setCurrentView] = useState<View>('session')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch(`${API_BASE}/sessions`)
        if (response.ok) {
          const fetchedSessions: Session[] = await response.json()
          setSessions(fetchedSessions)
          
          // Auto-select first session if none selected
          if (!selectedSessionId && fetchedSessions.length > 0 && fetchedSessions[0]) {
            setSelectedSessionId(fetchedSessions[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
      }
    }

    fetchSessions()
    const interval = setInterval(fetchSessions, 5000) // Refresh every 5s

    return () => clearInterval(interval)
  }, [selectedSessionId])

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setCurrentView('session')
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
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full p-4">
            {currentView === 'session' && selectedSession && (
              <Suspense fallback={<SessionSkeleton />}>
                <SessionCard session={selectedSession} />
              </Suspense>
            )}

            {currentView === 'session' && !selectedSession && (
              <div className="flex items-center justify-center min-h-[calc(100vh-5rem)] text-gray-500">
                <div className="text-center">
                  <p className="text-lg mb-2">No session selected</p>
                  <p className="text-sm">Select a session from the sidebar or create a new one</p>
                </div>
              </div>
            )}

            {currentView === 'new' && <TaskForm />}

            {currentView === 'permissions' && <PermissionHistory />}

            {currentView === 'history' && <TaskHistory limit={20} />}
          </div>
        </div>
      </main>
    </div>
  )
}

function SessionSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-gray-800" />
}
