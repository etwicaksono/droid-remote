'use client'

import { ReactNode, useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Clock, Folder, Radio, Copy, Check, Pencil, AlertTriangle, X, ShieldCheck, Globe, User, Ban } from 'lucide-react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { ConnectionStatus } from '@/components/connection-status'
import { NotificationBell } from '@/components/notification-bell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatRelativeTime } from '@/lib/utils'
import { getSocket } from '@/lib/socket'
import { getAuthHeaders } from '@/lib/api'
import type { Session, ControlState } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface PageLayoutProps {
  children: ReactNode
  title?: string
  session?: Session
  currentPath: string
}

const STATUS_CONFIG = {
  running: { color: 'bg-yellow-500', label: 'Running', variant: 'warning' as const, description: 'Session is currently executing a task' },
  waiting: { color: 'bg-green-500', label: 'Waiting', variant: 'success' as const, description: 'Session is idle and ready for tasks' },
  stopped: { color: 'bg-red-500', label: 'Stopped', variant: 'destructive' as const, description: 'Session has been stopped' },
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
  const [envDirty, setEnvDirty] = useState(false)
  const [envDirtyDismissed, setEnvDirtyDismissed] = useState(false)
  
  // Permission rules state
  const [permissionRules, setPermissionRules] = useState<Array<{
    id: number
    tool_name: string
    pattern: string
    rule_type: 'allow' | 'deny'
    scope: 'global' | 'session'
    session_id?: string
  }>>([])
  const [rulesExpanded, setRulesExpanded] = useState(false)

  // Check if env is dirty on mount
  useEffect(() => {
    const checkEnvDirty = async () => {
      try {
        const res = await fetch(`${API_BASE}/config/env/dirty`, { headers: getAuthHeaders() })
        if (res.ok) {
          const data = await res.json()
          setEnvDirty(data.dirty)
        }
      } catch {
        // Ignore errors
      }
    }
    checkEnvDirty()
  }, [])

  const handleDismissEnvBanner = async () => {
    try {
      await fetch(`${API_BASE}/config/env/dismiss`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      setEnvDirty(false)
      setEnvDirtyDismissed(true)
    } catch {
      // Just hide it locally
      setEnvDirtyDismissed(true)
    }
  }

  // Load permission rules for session
  useEffect(() => {
    if (!session) {
      setPermissionRules([])
      return
    }
    
    const loadRules = async () => {
      try {
        const res = await fetch(`${API_BASE}/sessions/${session.id}/permissions/rules`, {
          headers: getAuthHeaders()
        })
        if (res.ok) {
          const data = await res.json()
          setPermissionRules(data.rules || [])
        }
      } catch (error) {
        console.error('Failed to load permission rules:', error)
      }
    }
    loadRules()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  const handleDeleteRule = async (ruleId: number) => {
    try {
      const res = await fetch(`${API_BASE}/permissions/rules/${ruleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      if (res.ok) {
        setPermissionRules(prev => prev.filter(r => r.id !== ruleId))
      }
    } catch (error) {
      console.error('Failed to delete rule:', error)
    }
  }

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
                  <span 
                    className={cn('h-2 w-2 rounded-full shrink-0', statusConfig.color)} 
                    title={statusConfig.description}
                  />
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
                  <NotificationBell />
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

              {/* Permission Rules - collapsible row (only when header expanded) */}
              {headerExpanded && permissionRules.length > 0 && (
                <div className="border-t border-gray-700/50 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setRulesExpanded(!rulesExpanded)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-800/50 transition-colors"
                  >
                    {rulesExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                    <span className="text-muted-foreground">Permission Rules ({permissionRules.length})</span>
                  </button>
                  {rulesExpanded && (
                    <div className="px-4 pb-3 space-y-1 max-h-[200px] overflow-y-auto">
                      {permissionRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center gap-2 p-2 rounded bg-gray-800/50 group"
                        >
                          {rule.rule_type === 'allow' ? (
                            <span className="flex items-center text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded shrink-0">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : (
                            <span className="flex items-center text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded shrink-0">
                              <Ban className="h-3 w-3" />
                            </span>
                          )}
                          <code className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded shrink-0">
                            {rule.tool_name}
                          </code>
                          <code className="flex-1 text-xs bg-gray-700/50 px-1.5 py-0.5 rounded truncate" title={rule.pattern}>
                            {rule.pattern}
                          </code>
                          <span title={rule.scope === 'global' ? 'Global rule' : 'Session rule'} className="shrink-0">
                            {rule.scope === 'global' ? (
                              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <User className="h-3.5 w-3.5 text-blue-400" />
                            )}
                          </span>
                          {rule.scope === 'session' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteRule(rule.id)
                              }}
                              className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              title="Delete rule"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground pt-2">
                        <Globe className="h-3 w-3 inline mr-1" />Global
                        <User className="h-3 w-3 inline ml-3 mr-1" />Session
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Simple title header
            <div className="flex items-center justify-between p-4 pl-16 md:pl-4">
              <h1 className="text-lg font-semibold">{title}</h1>
              <div className="flex items-center gap-2">
                <NotificationBell />
                <ConnectionStatus />
              </div>
            </div>
          )}
        </header>

        {/* Environment Restart Banner */}
        {envDirty && !envDirtyDismissed && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <p className="text-sm text-yellow-500 flex-1">
              Environment changed. Restart server to apply changes.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismissEnvBanner}
              className="text-yellow-500 hover:text-yellow-400 h-7 px-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-y-auto">
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
