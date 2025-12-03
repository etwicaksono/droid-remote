'use client'

import { useEffect, useState } from 'react'
import { getSocket } from '@/lib/socket'
import { formatDate } from '@/lib/utils'
import type { Notification } from '@/types'

interface Activity {
  id: string
  sessionName: string
  message: string
  type: string
  timestamp: Date
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    const socket = getSocket()

    const handleNotification = (notification: Notification) => {
      setActivities((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          sessionName: notification.session_name,
          message: notification.message.slice(0, 100),
          type: notification.type,
          timestamp: new Date(),
        },
        ...prev.slice(0, 49), // Keep last 50
      ])
    }

    socket.on('notification', handleNotification)

    return () => {
      socket.off('notification', handleNotification)
    }
  }, [])

  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
        <p className="text-sm text-muted-foreground">No recent activity</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="rounded-md border border-border bg-background p-3 text-sm"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{activity.sessionName}</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(activity.timestamp)}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground truncate">{activity.message}</p>
        </div>
      ))}
    </div>
  )
}
