'use client'

import { TaskForm } from '@/components/sessions/task-form'
import { PageLayout } from '@/components/layout/page-layout'

export default function HomePage() {
  return (
    <PageLayout title="Custom Task" currentPath="/">
      <TaskForm />
    </PageLayout>
  )
}
