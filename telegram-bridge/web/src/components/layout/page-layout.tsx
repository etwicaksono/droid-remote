'use client'

import { ReactNode, useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Clock, Folder, Radio, Copy, Check, Pencil } from 'lucide-react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { ConnectionStatus } from '@/components/connection-status'
import { Badge } from '@/components/ui/badge'
import { cn, formatRelativeTime } from '@/lib/utils'
import { getSocket } from '@/lib/socket'
import type { Session, ControlState } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface PageLayoutProps {
  children: ReactNode
  title?: string
  session?: Session
  currentPath: string
}

const STATUS_CONFIG = {
  running: { color: 'bg-yellow-500', label: 'Running', variant: 'warning' as const },
  waiting: { color: 'bg-green-500', label: 'Waiting', variant: 'success' as const },
  stopped: { color: 'bg-red-500', label: 'Stopped', variant: 'destructive' as const },
}

const CONTROL_STATE_CONFIG: Record<ControlState, { label: string }> = {
  cli_active: { label: 'CLI Active' },
  cli_waiting: { label: 'CLI Waiting' },
  remote_active: { label: 'Remote Control' },
  released: { label: 'Released' },
}

export function PageLayout({ children, title, session, currentPath }: PageLayoutProps) {
  const [headerExpanded, setHeaderExpanded] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState(session?.name || '')
  const [sessionName, setSessionName] = useState(session?.name || '')
  const [copiedSessionId, setCopiedSessionId] = useState(false)
  const [localControlState, setLocalControlState] = useState(session?.control_state)

  // Sync state when session prop changes
  useEffect(() => {
    if (session) {
      setSessionName(session.name)
      setEditingName(session.name)
      setLocalControlState(session.control_state)
    }
  }, [session?.name, session?.control_state, session])

  // Listen for sessions_update
  useEffect(() => {
    if (!session) return
    const socket = getSocket()
    
    const handleSessionsUpdate = (sessions: Session[]) => {
      const updated = sessions.find(s => s.id === session.id)
      if (updated) {
        setSessionName(updated.name)
        setLocalControlState(updated.control_state)
      }
    }
    
    socket.on('sessions_update', handleSessionsUpdate)
    return () => {
      socket.off('sessions_update', handleSessionsUpdate)
    }
  }, [session?.id, session])

  const handleCopySessionId = async () => {
    if (!session) return
    try {
      await navigator.clipboard.writeText(session.id)
      setCopiedSessionId(true)
      setTimeout(() => setCopiedSessionId(false), 2000)
    } catch (error) {
      console.error('Failed to copy session ID:', error)
    }
  }

  const handleStartEditName = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingName(sessionName)
    setIsEditingName(true)
  }

  const handleRenameSession = async () => {
    if (!session || !editingName.trim() || editingName === sessionName) {
      setIsEditingName(false)
      return
    }
    
    try {
      const response = await fetch(
        `${API_BASE}/sessions/${session.id}/rename?name=${encodeURIComponent(editingName.trim())}`,
        { method: 'PATCH' }
      )
      if (response.ok) {
        setSessionName(editingName.trim())
      }
    } catch (error) {
      console.error('Failed to rename session:', error)
    } finally {
      setIsEditingName(false)
    }
  }

  const handleEditNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSession()
    } else if (e.key === 'Escape') {
      setIsEditingName(false)
    }
  }

  const statusConfig = session ? STATUS_CONFIG[session.status] : null
  const controlState = localControlState || 'cli_active'
  const controlConfig = CONTROL_STATE_CONFIG[controlState]

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* Sidebar */}
      <AppSidebar currentPath={currentPath} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pl-0 md:pl-0">
        {/* Header */}
        <header className="border-b border-gray-800 shrink-0">
          {session && statusConfig ? (
            // Session Header
            <div 
              className="p-4 pl-16 md:pl-4 cursor-pointer group/header"
              onClick={() => !isEditingName && setHeaderExpanded(prev => !prev)}
            >
              {/* Main row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {headerExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn('h-2 w-2 rounded-full shrink-0', statusConfig.color)} />
                  {isEditingName ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleEditNameKeyDown}
                      onBlur={handleRenameSession}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-gray-700 text-white text-sm font-semibold px-2 py-0.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="font-semibold truncate">{sessionName}</span>
                      <button
                        onClick={handleStartEditName}
                        className="p-1 rounded opacity-0 group-hover/header:opacity-100 transition-opacity hover:bg-gray-700 text-muted-foreground hover:text-white"
                        title="Rename session"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </>
                  )}
                  {/* Desktop: inline timestamp */}
                  {!headerExpanded && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {formatRelativeTime(session.last_activity)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Desktop: show badges */}
                  <Badge variant="outline" className="text-xs hidden sm:flex">
                    <Radio className="h-3 w-3 mr-1" />
                    {controlConfig.label}
                  </Badge>
                  <Badge variant={statusConfig.variant} className="hidden sm:flex">{statusConfig.label}</Badge>
                  <ConnectionStatus />
                </div>
              </div>

              {/* Mobile: timestamp below title when collapsed */}
              {!headerExpanded && (
                <div className="text-xs text-muted-foreground pl-6 mt-1 sm:hidden">
                  {formatRelativeTime(session.last_activity)}
                </div>
              )}

              {/* Expanded details */}
              {headerExpanded && (
                <div className="flex flex-col gap-2 text-xs text-muted-foreground pl-6 mt-2">
                  {/* Mobile: show badges in expanded */}
                  <div className="flex items-center gap-2 sm:hidden">
                    <Badge variant="outline" className="text-xs">
                      <Radio className="h-3 w-3 mr-1" />
                      {controlConfig.label}
                    </Badge>
                    <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs select-all">{session.id}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopySessionId()
                      }}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                      title="Copy session ID"
                    >
                      {copiedSessionId ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Folder className="h-3 w-3 shrink-0" />
                    <span className="truncate" title={session.project_dir}>{session.project_dir}</span>
                  </div>
                  <LastActivityTime lastActivity={session.last_activity} />
                </div>
              )}
            </div>
          ) : (
            // Simple title header
            <div className="flex items-center justify-between p-4 pl-16 md:pl-4">
              <h1 className="text-lg font-semibold">{title}</h1>
              <ConnectionStatus />
            </div>
          )}
        </header>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col px-4 pb-4 min-h-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

function LastActivityTime({ lastActivity }: { lastActivity: string }) {
  const [showFull, setShowFull] = useState(false)
  
  const utcTime = lastActivity.endsWith('Z') ? lastActivity : lastActivity + 'Z'
  const fullTime = new Date(utcTime).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <span 
      className="flex items-center gap-1 cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation()
        setShowFull(prev => !prev)
      }}
      title={fullTime}
    >
      <Clock className="h-3 w-3 shrink-0" />
      <span className="sm:hidden">
        {showFull ? fullTime : formatRelativeTime(lastActivity)}
      </span>
      <span className="hidden sm:inline group-hover:hidden">
        {formatRelativeTime(lastActivity)}
      </span>
      <span className="hidden sm:group-hover:inline">
        {fullTime}
      </span>
    </span>
  )
}
