'use client'

import { TaskHistory } from '@/components/sessions/task-history'
import { PageLayout } from '@/components/layout/page-layout'

export default function HistoryPage() {
  return (
    <PageLayout title="Task History" currentPath="/history">
      <TaskHistory />
    </PageLayout>
  )
}
