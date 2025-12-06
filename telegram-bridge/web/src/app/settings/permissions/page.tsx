'use client'

import { PageLayout } from '@/components/layout/page-layout'
import { PermissionsTab } from '@/components/settings/permissions-tab'

export default function SettingsPermissionsPage() {
  return (
    <PageLayout title="Permissions Settings" currentPath="/settings/permissions">
      <div className="p-4">
        <PermissionsTab />
      </div>
    </PageLayout>
  )
}
