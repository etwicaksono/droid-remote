'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, Shield, Terminal, Clock, Check, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'
import type { PermissionRequest } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface GroupedPermissions {
  [sessionId: string]: {
    sessionName: string
    permissions: PermissionRequest[]
  }
}

interface PermissionHistoryProps {
  limit?: number
}

export function PermissionHistory({ limit = 50 }: PermissionHistoryProps) {
  const [permissions, setPermissions] = useState<PermissionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  const fetchPermissions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/permissions?limit=${limit}`)
      if (res.ok) {
        const data = await res.json()
        setPermissions(data.permissions || [])
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPermissions()
  }, [limit])

  // Group permissions by session, sorted by latest first
  const groupedPermissions: GroupedPermissions = permissions.reduce((acc, perm) => {
    const sessionId = perm.session_id || 'unknown'
    if (!acc[sessionId]) {
      acc[sessionId] = {
        sessionName: perm.session_name || sessionId.substring(0, 8),
        permissions: []
      }
    }
    acc[sessionId].permissions.push(perm)
    return acc
  }, {} as GroupedPermissions)

  // Sort sessions by their latest permission timestamp
  const sortedSessionIds = Object.keys(groupedPermissions).sort((a, b) => {
    const aLatest = groupedPermissions[a]?.permissions[0]?.created_at || ''
    const bLatest = groupedPermissions[b]?.permissions[0]?.created_at || ''
    return new Date(bLatest).getTime() - new Date(aLatest).getTime()
  })

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  const getDecisionIcon = (decision: string | undefined) => {
    switch (decision) {
      case 'approved':
        return <Check className="h-3 w-3 text-green-500" />
      case 'denied':
        return <X className="h-3 w-3 text-red-500" />
      case 'timeout':
        return <AlertCircle className="h-3 w-3 text-yellow-500" />
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />
    }
  }

  const getDecisionBadge = (decision: string | undefined) => {
    switch (decision) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>
      case 'timeout':
        return <Badge variant="warning">Timeout</Badge>
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg">Permission History</CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchPermissions}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && permissions.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No permission history found
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSessionIds.map((sessionId) => {
              const group = groupedPermissions[sessionId]
              if (!group) return null
              const isExpanded = expandedSessions.has(sessionId)
              const latestPerm = group.permissions[0]

              return (
                <div key={sessionId} className="border rounded-lg overflow-hidden">
                  {/* Session Header */}
                  <button
                    onClick={() => toggleSession(sessionId)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{group.sessionName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({group.permissions.length} request{group.permissions.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {getDecisionIcon(latestPerm?.decision)}
                      <span>{latestPerm?.created_at ? formatRelativeTime(latestPerm.created_at) : ''}</span>
                    </div>
                  </button>

                  {/* Expanded Permission List */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20">
                      {group.permissions.map((perm) => (
                        <div
                          key={perm.id}
                          className="p-3 border-b last:border-b-0 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Terminal className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <code className="text-sm bg-muted px-1 rounded truncate">
                                {perm.tool_name || 'Unknown'}
                              </code>
                            </div>
                            {getDecisionBadge(perm.decision)}
                          </div>

                          {perm.message && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {perm.message}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(perm.created_at)}
                            </span>
                            {perm.decided_by && (
                              <span>by {perm.decided_by}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
