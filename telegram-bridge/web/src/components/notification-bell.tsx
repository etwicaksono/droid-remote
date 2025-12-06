'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, ShieldCheck, CheckCircle, AlertTriangle, Clock, X } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { getSocket } from '@/lib/socket'
import { getAuthHeaders } from '@/lib/api'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface Notification {
  id: number
  session_id: string
  type: 'permission_request' | 'task_completed' | 'task_failed' | 'cli_waiting'
  title: string
  message: string | null
  read: number
  created_at: string
}

const NOTIFICATION_CONFIG = {
  permission_request: {
    icon: ShieldCheck,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'Permission Request',
  },
  task_completed: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Task Completed',
  },
  task_failed: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: 'Task Failed',
  },
  cli_waiting: {
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'CLI Waiting',
  },
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications?limit=20`, {
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
  }

  useEffect(() => {
    fetchNotifications()

    // Listen for new notifications via WebSocket
    const socket = getSocket()
    
    const handleNotification = () => {
      fetchNotifications()
    }

    const handleTaskCompleted = () => {
      fetchNotifications()
    }

    socket.on('notification', handleNotification)
    socket.on('task_completed', handleTaskCompleted)

    return () => {
      socket.off('notification', handleNotification)
      socket.off('task_completed', handleTaskCompleted)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMarkRead = async (notificationId: number) => {
    try {
      await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      })
      fetchNotifications()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      })
      fetchNotifications()
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  const handleClearAll = async () => {
    try {
      await fetch(`${API_BASE}/notifications`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      setNotifications([])
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to clear notifications:', error)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-white rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => {
                const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.task_completed
                const Icon = config.icon
                const isUnread = notification.read === 0

                return (
                  <Link
                    key={notification.id}
                    href={`/session/${notification.session_id}`}
                    onClick={() => {
                      handleMarkRead(notification.id)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'block px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors',
                      isUnread && 'bg-gray-800/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('p-1.5 rounded', config.bgColor)}>
                        <Icon className={cn('h-4 w-4', config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{notification.title}</span>
                          {isUnread && (
                            <span className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        {notification.message && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700 bg-gray-900/50">
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Mark all read
              </button>
              <button
                onClick={handleClearAll}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
