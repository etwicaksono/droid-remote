'use client'

import { PermissionHistory } from '@/components/sessions/permission-history'
import { PageLayout } from '@/components/layout/page-layout'

export default function PermissionsPage() {
  return (
    <PageLayout title="Permission Requests" currentPath="/permissions">
      <PermissionHistory />
    </PageLayout>
  )
}
