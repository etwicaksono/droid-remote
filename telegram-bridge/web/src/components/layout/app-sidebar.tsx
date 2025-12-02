'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Terminal, Menu, Plus, ShieldCheck, History, Circle, X, Trash2 } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
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
  
  // Extract selected session ID from path
  const selectedSessionId = currentPath.startsWith('/session/') 
    ? currentPath.replace('/session/', '') 
    : null

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
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
      }
    }

    fetchSessions()
    const interval = setInterval(fetchSessions, 5000) // Refresh every 5s

    return () => clearInterval(interval)
  }, [])

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

          {/* History */}
          <Link
            href="/history"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 p-3 rounded-md text-sm font-medium transition-colors',
              currentPath === '/history'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
            )}
          >
            <History className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>History</span>}
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

                return (
                  <div
                    key={session.id}
                    className={cn(
                      'relative w-full p-3 rounded-md transition-colors mb-1 group',
                      isSelected
                        ? 'bg-gray-800 text-white border-l-4 border-blue-500'
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                    )}
                  >
                    <Link
                      href={`/session/${session.id}`}
                      onClick={() => setMobileOpen(false)}
                      className="w-full text-left block"
                    >
                      {collapsed ? (
                        // Collapsed view: just indicator bar
                        <div className={cn('w-full h-3', isSelected && 'border-l-4 border-blue-500')} />
                      ) : (
                        // Full view
                        <div>
                          <div className="font-medium text-sm truncate mb-1 pr-8">
                            {session.name || session.project_dir?.split('/').pop() || 'Unnamed'}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <span className={cn('h-2 w-2 rounded-full', statusInfo.color)} />
                            <span>{statusInfo.label}</span>
                            <span>•</span>
                            <SidebarActivityTime lastActivity={session.last_activity} />
                          </div>
                        </div>
                      )}
                    </Link>
                    
                    {/* Delete button (visible on hover) */}
                    {!collapsed && deleteConfirmId !== session.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmId(session.id)
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                        title="Delete session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
  const [showFull, setShowFull] = useState(false)
  
  // Ensure UTC parsing by appending Z if missing
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
      className="cursor-pointer group"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setShowFull(prev => !prev)
      }}
      title={fullTime}
    >
      <span className="md:hidden">
        {showFull ? fullTime : formatRelativeTime(lastActivity)}
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
