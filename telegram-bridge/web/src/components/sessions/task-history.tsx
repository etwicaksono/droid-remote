'use client'

import { useState, useEffect } from 'react'
import { Clock, CheckCircle, XCircle, Play, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'
import type { Task, Session } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface TasksBySession {
  session: Session
  tasks: Task[]
}

export function TaskHistory() {
  const [tasksBySession, setTasksBySession] = useState<TasksBySession[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  const fetchHistory = async () => {
    setLoading(true)
    try {
      // Fetch all sessions
      const sessionsRes = await fetch(`${API_BASE}/sessions`)
      if (!sessionsRes.ok) throw new Error('Failed to fetch sessions')
      const sessions: Session[] = await sessionsRes.json()

      // Fetch tasks for each session
      const historyPromises = sessions.map(async (session) => {
        const tasksRes = await fetch(`${API_BASE}/tasks?session_id=${session.id}`)
        if (tasksRes.ok) {
          const data = await tasksRes.json()
          return {
            session,
            tasks: data.tasks || []
          }
        }
        return { session, tasks: [] }
      })

      const history = await Promise.all(historyPromises)
      // Only show sessions that have tasks
      const filtered = history.filter(h => h.tasks.length > 0)
      // Sort by most recent task
      filtered.sort((a, b) => {
        const latestA = a.tasks[0]?.created_at || ''
        const latestB = b.tasks[0]?.created_at || ''
        return latestB.localeCompare(latestA)
      })
      
      setTasksBySession(filtered)
    } catch (error) {
      console.error('Failed to fetch history:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedSessions(newExpanded)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg">Task History</CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchHistory} className="w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="ml-2 sm:hidden">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && tasksBySession.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : tasksBySession.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">No task history found</div>
        ) : (
          <div className="space-y-4">
            {tasksBySession.map(({ session, tasks }) => {
              const isExpanded = expandedSessions.has(session.id)
              const successCount = tasks.filter(t => t.success === true).length
              const failedCount = tasks.filter(t => t.success === false).length
              
              return (
                <div key={session.id} className="border rounded-md">
                  {/* Session Header */}
                  <button
                    onClick={() => toggleSession(session.id)}
                    className="w-full p-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      <div className="flex flex-col items-start min-w-0">
                        <span className="font-medium text-sm truncate">{session.name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {session.project_dir}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {tasks.length} tasks
                      </Badge>
                      {successCount > 0 && (
                        <span className="text-xs text-green-500">{successCount}✓</span>
                      )}
                      {failedCount > 0 && (
                        <span className="text-xs text-red-500">{failedCount}✗</span>
                      )}
                    </div>
                  </button>

                  {/* Task List */}
                  {isExpanded && (
                    <div className="border-t p-3 space-y-2 bg-muted/20">
                      {tasks.map((task) => (
                        <TaskItem key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
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
      className="border rounded-md p-3 cursor-pointer hover:bg-background transition-colors bg-background"
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
