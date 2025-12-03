'use client'

import { Shield, Terminal, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'
import type { PermissionRequest } from '@/types'

interface PermissionCardProps {
  permission: PermissionRequest
  sessionName?: string
}

export function PermissionCard({ permission, sessionName }: PermissionCardProps) {
  return (
    <Card className={permission.decision === 'pending' || !permission.decision ? 'border-yellow-500/50' : ''}>
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
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-24 sm:max-h-32">
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
      </CardContent>
    </Card>
  )
}
