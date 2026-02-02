'use client'

import { PageLayout } from '@/components/layout/page-layout'
import { FactorySettingsTab } from '@/components/settings/factory-settings-tab'

export default function SettingsCLIPage() {
  return (
    <PageLayout title="Factory CLI Settings" currentPath="/settings/cli">
      <div className="p-4">
        <FactorySettingsTab />
      </div>
    </PageLayout>
  )
}
