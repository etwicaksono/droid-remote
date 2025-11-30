'use client'

import { useState } from 'react'
import { Shield, Terminal, Clock, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'
import type { PermissionRequest } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface PermissionCardProps {
  permission: PermissionRequest
  sessionName?: string
  onResolved?: () => void
}

export function PermissionCard({ permission, sessionName, onResolved }: PermissionCardProps) {
  const [loading, setLoading] = useState(false)
  const isPending = permission.decision === 'pending' || !permission.decision

  const handleResolve = async (decision: 'approved' | 'denied') => {
    setLoading(true)
    try {
      const res = await fetch(
        `${API_BASE}/sessions/${permission.session_id}/permissions/${permission.id}/resolve?decision=${decision}`,
        { method: 'POST' }
      )
      if (res.ok) {
        onResolved?.()
      }
    } catch (error) {
      console.error('Failed to resolve permission:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={isPending ? 'border-yellow-500/50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-yellow-500" />
            <CardTitle className="text-sm font-medium">
              Permission Request
            </CardTitle>
          </div>
          <Badge
            variant={
              permission.decision === 'approved'
                ? 'success'
                : permission.decision === 'denied'
                ? 'destructive'
                : 'warning'
            }
          >
            {permission.decision || 'pending'}
          </Badge>
        </div>
        {sessionName && (
          <p className="text-xs text-muted-foreground">Session: {sessionName}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm whitespace-pre-wrap">{permission.message}</p>

        {permission.tool_name && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Terminal className="h-3 w-3" />
            <code className="bg-muted px-1 rounded">{permission.tool_name}</code>
          </div>
        )}

        {permission.tool_input && Object.keys(permission.tool_input).length > 0 && (
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
            {JSON.stringify(permission.tool_input, null, 2)}
          </pre>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(permission.created_at)}
          </span>
          {permission.decided_by && (
            <span>Decided by: {permission.decided_by}</span>
          )}
        </div>

        {isPending && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => handleResolve('approved')}
              disabled={loading}
              className="flex-1"
            >
              <Check className="h-3 w-3 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleResolve('denied')}
              disabled={loading}
              className="flex-1"
            >
              <X className="h-3 w-3 mr-1" />
              Deny
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
