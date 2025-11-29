'use client'

import { useState, type FormEvent } from 'react'
import { Clock, Folder, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSessionActions } from '@/hooks/use-session-actions'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Session } from '@/types'

interface SessionCardProps {
  session: Session
}

const STATUS_CONFIG = {
  running: { color: 'bg-yellow-500', label: 'Running', variant: 'warning' as const },
  waiting: { color: 'bg-green-500', label: 'Waiting', variant: 'success' as const },
  stopped: { color: 'bg-red-500', label: 'Stopped', variant: 'destructive' as const },
}

export function SessionCard({ session }: SessionCardProps) {
  const [message, setMessage] = useState('')
  const { respond, approve, deny } = useSessionActions()

  const statusConfig = STATUS_CONFIG[session.status]
  const hasPendingRequest = session.pending_request !== null

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

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', statusConfig.color)} />
          <span className="font-semibold">{session.name}</span>
        </div>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
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
