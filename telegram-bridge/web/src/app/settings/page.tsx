'use client'

import { useState } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import { PermissionsTab } from '@/components/settings/permissions-tab'
import { FactorySettingsTab } from '@/components/settings/factory-settings-tab'
import { cn } from '@/lib/utils'

type TabId = 'permissions' | 'factory'

const TABS: { id: TabId; label: string }[] = [
  { id: 'permissions', label: 'Permissions' },
  { id: 'factory', label: 'Factory CLI' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('permissions')

  return (
    <PageLayout title="Settings" currentPath="/settings">
      <div className="p-4">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-800">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-white'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'permissions' && <PermissionsTab />}
        {activeTab === 'factory' && <FactorySettingsTab />}
      </div>
    </PageLayout>
  )
}
