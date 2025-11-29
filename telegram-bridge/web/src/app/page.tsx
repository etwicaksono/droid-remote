import { Suspense } from 'react'
import { SessionList } from '@/components/sessions/session-list'
import { ActivityFeed } from '@/components/activity/activity-feed'
import { ConnectionStatus } from '@/components/connection-status'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <header className="mb-6 flex items-center justify-between max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Droid Control</h1>
          <p className="text-gray-400">Manage your Factory.ai Droid sessions</p>
        </div>
        <ConnectionStatus />
      </header>

      <div className="grid gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
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
        <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-800" />
      ))}
    </div>
  )
}

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-gray-800" />
      ))}
    </div>
  )
}
