'use client'

import { Suspense, useState } from 'react'
import { SessionList } from '@/components/sessions/session-list'
import { TaskForm } from '@/components/sessions/task-form'
import { TaskHistory } from '@/components/sessions/task-history'
import { PermissionHistory } from '@/components/sessions/permission-history'
import { ActivityFeed } from '@/components/activity/activity-feed'
import { ConnectionStatus } from '@/components/connection-status'

type Tab = 'sessions' | 'tasks' | 'permissions' | 'history'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sessions')

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <header className="mb-6 flex items-center justify-between max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Droid Control</h1>
          <p className="text-gray-400">Manage your Factory.ai Droid sessions</p>
        </div>
        <ConnectionStatus />
      </header>

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex gap-2 border-b border-gray-700 pb-2">
          {(['sessions', 'tasks', 'permissions', 'history'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'sessions' && (
            <>
              <div>
                <h2 className="mb-4 text-lg font-semibold">Active Sessions</h2>
                <Suspense fallback={<SessionListSkeleton />}>
                  <SessionList />
                </Suspense>
              </div>
              <div>
                <h2 className="mb-4 text-lg font-semibold">Execute New Task</h2>
                <TaskForm />
              </div>
            </>
          )}

          {activeTab === 'tasks' && (
            <div>
              <h2 className="mb-4 text-lg font-semibold">Execute Task</h2>
              <TaskForm />
            </div>
          )}

          {activeTab === 'permissions' && (
            <div>
              <h2 className="mb-4 text-lg font-semibold">Permission Requests</h2>
              <PermissionHistory />
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <h2 className="mb-4 text-lg font-semibold">Task History</h2>
              <TaskHistory limit={20} />
            </div>
          )}
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
