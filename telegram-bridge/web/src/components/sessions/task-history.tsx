'use client'

import { useState, useEffect } from 'react'
import { Clock, CheckCircle, XCircle, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'
import type { Task } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface TaskHistoryProps {
  sessionId?: string
  limit?: number
}

export function TaskHistory({ sessionId, limit = 10 }: TaskHistoryProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showFailed, setShowFailed] = useState(false)

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (sessionId) params.append('session_id', sessionId)
      params.append('limit', String(limit))
      
      const endpoint = showFailed ? '/tasks/failed' : `/tasks?${params}`
      const res = await fetch(`${API_BASE}${endpoint}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [sessionId, limit, showFailed])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg">Task History</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              variant={showFailed ? 'default' : 'outline'}
              onClick={() => setShowFailed(!showFailed)}
              className="w-full sm:w-auto"
            >
              <span className="hidden sm:inline">{showFailed ? 'Show All Tasks' : 'Show Failed Only'}</span>
              <span className="sm:hidden">{showFailed ? 'All' : 'Failed'}</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={fetchTasks} className="w-full sm:w-auto">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-2 sm:hidden">Refresh</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && tasks.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">No tasks found</div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TaskItem({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {task.success === true ? (
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          ) : task.success === false ? (
            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          ) : (
            <Play className="h-4 w-4 text-yellow-500 shrink-0" />
          )}
          <p className="text-sm truncate">{task.prompt}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs">
          {task.source}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(task.created_at)}
        </span>
        {task.duration_ms !== undefined && task.duration_ms > 0 && (
          <span>{task.duration_ms}ms</span>
        )}
        {task.num_turns !== undefined && task.num_turns > 0 && (
          <span>{task.num_turns} turns</span>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="text-xs">
            <span className="text-muted-foreground">Project: </span>
            <code className="bg-muted px-1 rounded">{task.project_dir}</code>
          </div>
          {task.model && (
            <div className="text-xs">
              <span className="text-muted-foreground">Model: </span>
              {task.model}
            </div>
          )}
          {task.error && (
            <div className="text-xs text-destructive">
              <span className="font-medium">Error: </span>
              {task.error}
            </div>
          )}
          {task.result && (
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32 sm:max-h-40 whitespace-pre-wrap">
              {task.result}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
