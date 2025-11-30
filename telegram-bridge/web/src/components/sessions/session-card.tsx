'use client'

import { useState, type FormEvent } from 'react'
import { Clock, Folder, Terminal, Radio, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSessionActions } from '@/hooks/use-session-actions'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Session, ControlState } from '@/types'

interface SessionCardProps {
  session: Session
}

const STATUS_CONFIG = {
  running: { color: 'bg-yellow-500', label: 'Running', variant: 'warning' as const },
  waiting: { color: 'bg-green-500', label: 'Waiting', variant: 'success' as const },
  stopped: { color: 'bg-red-500', label: 'Stopped', variant: 'destructive' as const },
}

const CONTROL_STATE_CONFIG: Record<ControlState, { label: string; color: string; description: string }> = {
  cli_active: { label: 'CLI Active', color: 'bg-blue-500', description: 'CLI is running' },
  cli_waiting: { label: 'CLI Waiting', color: 'bg-blue-400', description: 'CLI at stop point' },
  remote_active: { label: 'Remote Control', color: 'bg-purple-500', description: 'Under remote control' },
  released: { label: 'Released', color: 'bg-gray-500', description: 'Waiting for CLI' },
}

export function SessionCard({ session }: SessionCardProps) {
  const [message, setMessage] = useState('')
  const { respond, approve, deny, handoff, release, loading } = useSessionActions()

  const statusConfig = STATUS_CONFIG[session.status]
  const controlState = session.control_state || 'cli_active'
  const controlConfig = CONTROL_STATE_CONFIG[controlState]
  const hasPendingRequest = session.pending_request !== null
  const isRemoteControlled = controlState === 'remote_active'
  const canHandoff = controlState === 'cli_active' || controlState === 'cli_waiting'

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!message.trim() || !session.pending_request) return

    respond({
      sessionId: session.id,
      response: message,
    })
    setMessage('')
  }

  const handleApprove = () => {
    if (session.pending_request) {
      approve({ sessionId: session.id })
    }
  }

  const handleDeny = () => {
    if (session.pending_request) {
      deny({ sessionId: session.id })
    }
  }

  const handleHandoff = async () => {
    try {
      await handoff({ sessionId: session.id })
    } catch (error) {
      console.error('Handoff failed:', error)
    }
  }

  const handleRelease = async () => {
    try {
      await release({ sessionId: session.id })
    } catch (error) {
      console.error('Release failed:', error)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', statusConfig.color)} />
          <span className="font-semibold">{session.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Radio className="h-3 w-3 mr-1" />
            {controlConfig.label}
          </Badge>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Folder className="h-3 w-3" />
            {session.project_dir}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(session.last_activity)}
          </span>
        </div>

        {/* Control State Actions */}
        <div className="flex gap-2">
          {canHandoff && (
            <Button size="sm" variant="outline" onClick={handleHandoff} disabled={loading}>
              <Play className="h-3 w-3 mr-1" />
              Take Control
            </Button>
          )}
          {isRemoteControlled && (
            <Button size="sm" variant="outline" onClick={handleRelease} disabled={loading}>
              <Square className="h-3 w-3 mr-1" />
              Release to CLI
            </Button>
          )}
        </div>

        {hasPendingRequest && session.pending_request && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm whitespace-pre-wrap">{session.pending_request.message}</p>

            {session.pending_request.tool_name && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Terminal className="h-3 w-3" />
                <code>{session.pending_request.tool_name}</code>
              </div>
            )}

            {session.pending_request.type === 'permission' && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={handleApprove}>
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={handleDeny}>
                  Deny
                </Button>
              </div>
            )}
          </div>
        )}

        {(session.status === 'waiting' || hasPendingRequest) && (
          <form className="flex gap-2" onSubmit={handleSubmit}>
            <Input
              className="flex-1"
              placeholder="Send instruction..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button disabled={!message.trim() || !hasPendingRequest} type="submit">
              Send
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
