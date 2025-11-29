'use client'

import { useSessions } from '@/hooks/use-sessions'
import { SessionCard } from './session-card'

export function SessionList() {
  const { sessions, isLoading, isError } = useSessions()

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-center">
        <p className="text-destructive">Failed to load sessions</p>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
        <p className="text-muted-foreground">No active sessions</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a Droid session to see it here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  )
}
