'use client'

import { useState, useEffect } from 'react'
import { Terminal, Menu, Plus, ShieldCheck, History, Circle, X } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Session, ControlState } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface AppSidebarProps {
  selectedSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onSelectView: (view: 'new' | 'permissions' | 'history') => void
  currentView: 'session' | 'new' | 'permissions' | 'history'
}

const STATUS_CONFIG: Record<ControlState, { color: string; label: string }> = {
  remote_active: { color: 'bg-purple-500', label: 'Remote' },
  cli_active: { color: 'bg-blue-500', label: 'CLI' },
  cli_waiting: { color: 'bg-yellow-500', label: 'Waiting' },
  released: { color: 'bg-gray-500', label: 'Released' },
}

export function AppSidebar({
  selectedSessionId,
  onSelectSession,
  onSelectView,
  currentView,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch(`${API_BASE}/sessions`)
        if (response.ok) {
          const data = await response.json()
          setSessions(data.sessions || [])
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
      }
    }

    fetchSessions()
    const interval = setInterval(fetchSessions, 5000) // Refresh every 5s

    return () => clearInterval(interval)
  }, [])

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId)
    setMobileOpen(false) // Close mobile menu after selection
  }

  const handleSelectView = (view: 'new' | 'permissions' | 'history') => {
    onSelectView(view)
    setMobileOpen(false) // Close mobile menu after selection
  }

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:sticky top-0 left-0 h-screen bg-gray-950 border-r border-gray-800 flex flex-col z-50',
          'transition-all duration-300 ease-in-out',
          // Desktop
          collapsed ? 'hidden md:flex md:w-12' : 'md:w-60',
          // Mobile
          mobileOpen ? 'translate-x-0 w-60' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-800">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-base">Droid</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-800 rounded hidden md:block"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 hover:bg-gray-800 rounded md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col p-2 border-b border-gray-800">
          {/* New Session */}
          <button
            onClick={() => handleSelectView('new')}
            className={cn(
              'flex items-center gap-2 p-3 rounded-md text-sm font-medium transition-colors',
              currentView === 'new'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
            )}
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>New Session</span>}
          </button>

          {/* Permissions */}
          <button
            onClick={() => handleSelectView('permissions')}
            className={cn(
              'flex items-center gap-2 p-3 rounded-md text-sm font-medium transition-colors',
              currentView === 'permissions'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
            )}
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Permissions</span>}
          </button>

          {/* History */}
          <button
            onClick={() => handleSelectView('history')}
            className={cn(
              'flex items-center gap-2 p-3 rounded-md text-sm font-medium transition-colors',
              currentView === 'history'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
            )}
          >
            <History className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>History</span>}
          </button>
        </div>

        {/* Sessions Section */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Sessions
            </h3>
          </div>
        )}

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            !collapsed && (
              <div className="p-3 text-sm text-gray-500 text-center">
                No active sessions
              </div>
            )
          ) : (
            <div className="p-2">
              {sessions.map((session) => {
                const isSelected = selectedSessionId === session.session_id
                const statusInfo = STATUS_CONFIG[session.control_state] || {
                  color: 'bg-gray-500',
                  label: 'Unknown',
                }

                return (
                  <button
                    key={session.session_id}
                    onClick={() => handleSelectSession(session.session_id)}
                    className={cn(
                      'w-full text-left p-3 rounded-md transition-colors mb-1',
                      isSelected
                        ? 'bg-gray-800 text-white border-l-4 border-blue-500'
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                    )}
                  >
                    {collapsed ? (
                      // Collapsed view: just indicator bar
                      <div className={cn('w-full h-3', isSelected && 'border-l-4 border-blue-500')} />
                    ) : (
                      // Full view
                      <div>
                        <div className="font-medium text-sm truncate mb-1">
                          {session.name || session.project_dir?.split('/').pop() || 'Unnamed'}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span className={cn('h-2 w-2 rounded-full', statusInfo.color)} />
                          <span>{statusInfo.label}</span>
                          <span>•</span>
                          <span>{formatRelativeTime(session.last_activity)}</span>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-30 p-2 bg-gray-900 border border-gray-800 rounded-md md:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>
    </>
  )
}
