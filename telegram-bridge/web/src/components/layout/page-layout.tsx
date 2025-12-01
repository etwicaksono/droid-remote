'use client'

import { ReactNode } from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { ConnectionStatus } from '@/components/connection-status'

interface PageLayoutProps {
  children: ReactNode
  title: string
  currentPath: string
}

export function PageLayout({ children, title, currentPath }: PageLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* Sidebar */}
      <AppSidebar currentPath={currentPath} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pl-0 md:pl-0">
        {/* Header */}
        <header className="flex items-center justify-between p-4 pl-16 md:pl-4 border-b border-gray-800">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          <ConnectionStatus />
        </header>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col p-4 min-h-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
