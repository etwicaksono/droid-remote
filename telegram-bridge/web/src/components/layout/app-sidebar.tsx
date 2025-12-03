'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Terminal, Menu, Plus, ShieldCheck, Circle, X, Trash2, Pencil, Settings } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { getSocket } from '@/lib/socket'
import type { Session, ControlState } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface AppSidebarProps {
  currentPath: string
}

const STATUS_CONFIG: Record<ControlState, { color: string; label: string }> = {
  remote_active: { color: 'bg-purple-500', label: 'Remote' },
  cli_active: { color: 'bg-blue-500', label: 'CLI' },
  cli_waiting: { color: 'bg-yellow-500', label: 'Waiting' },
  released: { color: 'bg-gray-500', label: 'Released' },
}

export function AppSidebar({ currentPath }: AppSidebarProps) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  
  // Extract selected session ID from path
  const selectedSessionId = currentPath.startsWith('/session/') 
    ? currentPath.replace('/session/', '') 
    : null

  // Sort sessions by last_activity (most recent first)
  const sortSessions = useCallback((sessionList: Session[]) => {
    return [...sessionList].sort((a, b) => {
      const dateA = new Date(a.last_activity).getTime()
      const dateB = new Date(b.last_activity).getTime()
      return dateB - dateA
    })
  }, [])

  // Fetch sessions once on mount, then update via WebSocket
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch(`${API_BASE}/sessions`)
        if (response.ok) {
          const fetchedSessions: Session[] = await response.json()
          setSessions(sortSessions(fetchedSessions))
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
      }
    }

    // Initial fetch
    fetchSessions()

    // Listen for WebSocket events to update sessions
    const socket = getSocket()
    
    const handleSessionsUpdate = (updatedSessions: Session[]) => {
      setSessions(sortSessions(updatedSessions))
    }
    
    const handleTaskCompleted = () => {
      // Refetch sessions when a task completes (updates last_activity)
      fetchSessions()
    }
    
    const handleChatUpdated = () => {
      // Refetch sessions when chat updates (updates last_activity)
      fetchSessions()
    }
    
    const handleConnect = () => {
      // Re-fetch sessions on socket connect/reconnect to catch any missed updates
      fetchSessions()
    }
    
    socket.on('sessions_update', handleSessionsUpdate)
    socket.on('task_completed', handleTaskCompleted)
    socket.on('chat_updated', handleChatUpdated)
    socket.on('connect', handleConnect)
    
    // Also fetch on reconnect (socket.io fires 'connect' on reconnect too, but be explicit)
    socket.io.on('reconnect', handleConnect)

    return () => {
      socket.off('sessions_update', handleSessionsUpdate)
      socket.off('task_completed', handleTaskCompleted)
      socket.off('chat_updated', handleChatUpdated)
      socket.off('connect', handleConnect)
      socket.io.off('reconnect', handleConnect)
    }
  }, [sortSessions])

  const handleNavigate = (path: string) => {
    router.push(path)
    setMobileOpen(false) // Close mobile menu after navigation
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        // If deleting the selected session, go home
        if (selectedSessionId === sessionId) {
          router.push('/')
        }
        // Refresh sessions list
        const fetchResponse = await fetch(`${API_BASE}/sessions`)
        if (fetchResponse.ok) {
          const fetchedSessions: Session[] = await fetchResponse.json()
          const sortedSessions = fetchedSessions.sort((a, b) => {
            const dateA = new Date(a.last_activity).getTime()
            const dateB = new Date(b.last_activity).getTime()
            return dateB - dateA
          })
          setSessions(sortedSessions)
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    } finally {
      setDeleteConfirmId(null)
    }
  }

  const handleStartEdit = (session: Session, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingSessionId(session.id)
    setEditingName(session.name)
    setDeleteConfirmId(null)
  }

  const handleRenameSession = async (sessionId: string) => {
    if (!editingName.trim()) {
      setEditingSessionId(null)
      return
    }
    
    try {
      const response = await fetch(
        `${API_BASE}/sessions/${sessionId}/rename?name=${encodeURIComponent(editingName.trim())}`,
        { method: 'PATCH' }
      )
      if (response.ok) {
        // WebSocket will update the sessions list
      }
    } catch (error) {
      console.error('Failed to rename session:', error)
    } finally {
      setEditingSessionId(null)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSession(sessionId)
    } else if (e.key === 'Escape') {
      setEditingSessionId(null)
    }
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
          {/* Custom Task */}
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 p-3 rounded-md text-sm font-medium transition-colors',
              currentPath === '/'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
            )}
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Custom Task</span>}
          </Link>

          {/* Permissions */}
          <Link
            href="/permissions"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 p-3 rounded-md text-sm font-medium transition-colors',
              currentPath === '/permissions'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
            )}
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Permissions</span>}
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 p-3 rounded-md text-sm font-medium transition-colors',
              currentPath === '/settings'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
            )}
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Link>

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
                const isSelected = selectedSessionId === session.id
                const statusInfo = STATUS_CONFIG[session.control_state || 'released'] || {
                  color: 'bg-gray-500',
                  label: 'Unknown',
                }

                const isEditing = editingSessionId === session.id

                return (
                  <div
                    key={session.id}
                    className="relative mb-1 group"
                  >
                    <Link
                      href={`/session/${session.id}`}
                      onClick={(e) => {
                        if (isEditing) e.preventDefault()
                        else setMobileOpen(false)
                      }}
                      className={cn(
                        'w-full text-left block p-3 rounded-md transition-colors',
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
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, session.id)}
                              onBlur={() => handleRenameSession(session.id)}
                              onClick={(e) => e.preventDefault()}
                              className="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500 mb-1"
                              autoFocus
                            />
                          ) : (
                            <div className="font-medium text-sm truncate mb-1 pr-14">
                              {session.name || session.project_dir?.split('/').pop() || 'Unnamed'}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <span className={cn('h-2 w-2 rounded-full', statusInfo.color)} />
                            <span>{statusInfo.label}</span>
                            <span>•</span>
                            <SidebarActivityTime lastActivity={session.last_activity} />
                          </div>
                        </div>
                      )}
                    </Link>
                    
                    {/* Edit & Delete buttons (visible on hover) */}
                    {!collapsed && !isEditing && deleteConfirmId !== session.id && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleStartEdit(session, e)}
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-white"
                          title="Rename session"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            setDeleteConfirmId(session.id)
                          }}
                          className="p-1.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                        title="Delete session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      </div>
                    )}
                    
                    {/* Delete confirmation */}
                    {!collapsed && deleteConfirmId === session.id && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSession(session.id)
                          }}
                          className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded"
                          title="Confirm delete"
                        >
                          Delete
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmId(null)
                          }}
                          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
                          title="Cancel"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
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

function SidebarActivityTime({ lastActivity }: { lastActivity: string }) {
  // Ensure UTC parsing by appending Z if missing
  const utcTime = lastActivity.endsWith('Z') ? lastActivity : lastActivity + 'Z'
  const fullTime = new Date(utcTime).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  // No click handler - let clicks pass through to parent Link
  // Desktop: hover shows full time, Mobile: just shows relative time
  return (
    <span className="group" title={fullTime}>
      <span className="md:hidden">
        {formatRelativeTime(lastActivity)}
      </span>
      <span className="hidden md:inline group-hover:hidden">
        {formatRelativeTime(lastActivity)}
      </span>
      <span className="hidden md:group-hover:inline">
        {fullTime}
      </span>
    </span>
  )
}
