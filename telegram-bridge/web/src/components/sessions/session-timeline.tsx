'use client'

import { useState, useEffect } from 'react'
import { Clock, Shield, Play, Settings, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface TimelineItem {
  type: 'event' | 'permission' | 'task'
  action: string
  data?: string
  created_at: string
}

interface SessionTimelineProps {
  sessionId: string
  limit?: number
}

export function SessionTimeline({ sessionId, limit = 30 }: SessionTimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/timeline?limit=${limit}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.timeline || [])
      }
    } catch (error) {
      console.error('Failed to fetch timeline:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTimeline()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, limit])

  const getIcon = (type: string) => {
    switch (type) {
      case 'event':
        return <Settings className="h-3 w-3" />
      case 'permission':
        return <Shield className="h-3 w-3" />
      case 'task':
        return <Play className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }

  const getColor = (type: string) => {
    switch (type) {
      case 'event':
        return 'bg-blue-500'
      case 'permission':
        return 'bg-yellow-500'
      case 'task':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg">Session Timeline</CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchTimeline}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && items.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">No events found</div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />
            
            <div className="space-y-2 sm:space-y-3">
              {items.map((item, i) => (
                <div key={i} className="flex gap-3 relative">
                  {/* Dot */}
                  <div className={`w-4 h-4 rounded-full ${getColor(item.type)} flex items-center justify-center text-white shrink-0 z-10`}>
                    {getIcon(item.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <Badge variant="outline" className="text-[10px] sm:text-xs">
                        {item.type}
                      </Badge>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <p className="text-sm mt-1 truncate">{item.action}</p>
                    {item.data && (
                      <pre className="text-xs text-muted-foreground mt-1 truncate">
                        {typeof item.data === 'string' ? item.data : JSON.stringify(item.data)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
