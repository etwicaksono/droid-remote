import { Suspense } from 'react'
import { SessionList } from '@/components/sessions/session-list'
import { ActivityFeed } from '@/components/activity/activity-feed'
import { ConnectionStatus } from '@/components/connection-status'

export default function DashboardPage() {
  return (
    <div className="container mx-auto max-w-6xl p-4">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Droid Control</h1>
          <p className="text-muted-foreground">Manage your Factory.ai Droid sessions</p>
        </div>
        <ConnectionStatus />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Active Sessions</h2>
          <Suspense fallback={<SessionListSkeleton />}>
            <SessionList />
          </Suspense>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold">Activity</h2>
          <Suspense fallback={<ActivityFeedSkeleton />}>
            <ActivityFeed />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function SessionListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}
