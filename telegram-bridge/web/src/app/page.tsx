'use client'

import { Suspense, useState } from 'react'
import { SessionList } from '@/components/sessions/session-list'
import { TaskForm } from '@/components/sessions/task-form'
import { TaskHistory } from '@/components/sessions/task-history'
import { PermissionHistory } from '@/components/sessions/permission-history'
import { ConnectionStatus } from '@/components/connection-status'

type Tab = 'sessions' | 'custom' | 'permissions' | 'history'

const TAB_LABELS: Record<Tab, string> = {
  sessions: 'Sessions',
  custom: 'Custom Task',
  permissions: 'Permissions',
  history: 'History',
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sessions')

  return (
    <div className="min-h-screen bg-gray-900 text-white p-2 sm:p-4">
      <header className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-6xl mx-auto gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Droid Control</h1>
          <p className="text-sm sm:text-base text-gray-400 hidden sm:block">Manage your Factory.ai Droid sessions</p>
        </div>
        <ConnectionStatus />
      </header>

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto mb-4 sm:mb-6">
        <div className="flex gap-1 sm:gap-2 border-b border-gray-700 pb-2 overflow-x-auto">
          {(['sessions', 'custom', 'permissions', 'history'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2 rounded-t-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="space-y-4 sm:space-y-6">
          {activeTab === 'sessions' && (
            <div>
              <h2 className="mb-4 text-lg font-semibold">Active Sessions</h2>
              <Suspense fallback={<SessionListSkeleton />}>
                <SessionList />
              </Suspense>
            </div>
          )}

          {activeTab === 'custom' && (
            <div>
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
