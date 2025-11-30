'use client'

import { useState, type FormEvent } from 'react'
import { Clock, Folder, Terminal, Radio, Play, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useSessionActions } from '@/hooks/use-session-actions'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Session, ControlState } from '@/types'

interface SessionCardProps {
  session: Session
}

const STATUS_CONFIG = {
  running: { color: 'bg-yellow-500', label: 'Running', variant: 'warning' as const },
  waiting: { color: 'bg-green-500', label: 'Waiting', variant: 'success' as const },
  stopped: { color: 'bg-red-500', label: 'Stopped', variant: 'destructive' as const },
}

const CONTROL_STATE_CONFIG: Record<ControlState, { label: string; color: string; description: string }> = {
  cli_active: { label: 'CLI Active', color: 'bg-blue-500', description: 'CLI is running' },
  cli_waiting: { label: 'CLI Waiting', color: 'bg-blue-400', description: 'CLI at stop point' },
  remote_active: { label: 'Remote Control', color: 'bg-purple-500', description: 'Under remote control' },
  released: { label: 'Released', color: 'bg-gray-500', description: 'Waiting for CLI' },
}

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  status?: 'success' | 'error'
  meta?: { duration?: number; turns?: number }
}

export function SessionCard({ session }: SessionCardProps) {
  const [message, setMessage] = useState('')
  const [taskPrompt, setTaskPrompt] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [executing, setExecuting] = useState(false)
  const { respond, approve, deny, handoff, release, executeTask, loading } = useSessionActions()

  const statusConfig = STATUS_CONFIG[session.status]
  const controlState = session.control_state || 'cli_active'
  const controlConfig = CONTROL_STATE_CONFIG[controlState]
  const hasPendingRequest = session.pending_request !== null
  const isRemoteControlled = controlState === 'remote_active'
  const canHandoff = controlState === 'cli_active' || controlState === 'cli_waiting'

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!message.trim() || !session.pending_request) return

    respond({
      sessionId: session.id,
      response: message,
    })
    setMessage('')
  }

  const handleTaskSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!taskPrompt.trim() || executing) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: taskPrompt.trim(),
      timestamp: new Date(),
    }
    setChatHistory(prev => [...prev, userMessage])
    const prompt = taskPrompt.trim()
    setTaskPrompt('')
    setExecuting(true)

    try {
      const result = await executeTask({
        prompt,
        projectDir: session.project_dir,
        sessionId: session.id,
      })
      
      // Parse the result to get human-readable content
      let responseContent = ''
      if (result.error) {
        responseContent = result.error
      } else if (result.result) {
        // Try to parse if it's JSON
        try {
          const parsed = JSON.parse(result.result)
          responseContent = parsed.result || parsed.message || result.result
        } catch {
          responseContent = result.result
        }
      } else {
        responseContent = 'Task completed'
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        status: result.success ? 'success' : 'error',
        meta: {
          duration: result.duration_ms,
          turns: result.num_turns,
        },
      }
      setChatHistory(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: String(error),
        timestamp: new Date(),
        status: 'error',
      }
      setChatHistory(prev => [...prev, errorMessage])
    } finally {
      setExecuting(false)
    }
  }

  const handleApprove = () => {
    if (session.pending_request) {
      approve({ sessionId: session.id })
    }
  }

  const handleDeny = () => {
    if (session.pending_request) {
      deny({ sessionId: session.id })
    }
  }

  const handleHandoff = async () => {
    try {
      await handoff({ sessionId: session.id })
    } catch (error) {
      console.error('Handoff failed:', error)
    }
  }

  const handleRelease = async () => {
    try {
      await release({ sessionId: session.id })
    } catch (error) {
      console.error('Release failed:', error)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', statusConfig.color)} />
          <span className="font-semibold">{session.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Radio className="h-3 w-3 mr-1" />
            {controlConfig.label}
          </Badge>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Folder className="h-3 w-3" />
            {session.project_dir}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(session.last_activity)}
          </span>
        </div>

        {/* Control State Actions */}
        <div className="flex gap-2">
          {canHandoff && (
            <Button size="sm" variant="outline" onClick={handleHandoff} disabled={loading}>
              <Play className="h-3 w-3 mr-1" />
              Take Control
            </Button>
          )}
          {isRemoteControlled && (
            <Button size="sm" variant="outline" onClick={handleRelease} disabled={loading}>
              <Square className="h-3 w-3 mr-1" />
              Release to CLI
            </Button>
          )}
        </div>

        {hasPendingRequest && session.pending_request && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm whitespace-pre-wrap">{session.pending_request.message}</p>

            {session.pending_request.tool_name && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Terminal className="h-3 w-3" />
                <code>{session.pending_request.tool_name}</code>
              </div>
            )}

            {session.pending_request.type === 'permission' && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={handleApprove}>
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={handleDeny}>
                  Deny
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Response form for pending requests (CLI mode) */}
        {!isRemoteControlled && (session.status === 'waiting' || hasPendingRequest) && (
          <form className="flex gap-2" onSubmit={handleSubmit}>
            <Input
              className="flex-1"
              placeholder="Send response..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button disabled={!message.trim() || !hasPendingRequest} type="submit">
              Send
            </Button>
          </form>
        )}

        {/* Task execution form (Remote Control mode) */}
        {isRemoteControlled && (
          <div className="space-y-3 pt-2 border-t border-border">
            {/* Chat History */}
            {chatHistory.length > 0 && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {chatHistory.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}
                {executing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Droid is working...
                  </div>
                )}
              </div>
            )}

            {/* Input Form */}
            <form className="flex gap-2" onSubmit={handleTaskSubmit}>
              <Textarea
                placeholder="Enter task instruction..."
                rows={1}
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                disabled={executing}
                className="flex-1 min-h-[40px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (taskPrompt.trim() && !executing) {
                      handleTaskSubmit(e as unknown as FormEvent<HTMLFormElement>)
                    }
                  }
                }}
              />
              <Button 
                type="submit" 
                disabled={!taskPrompt.trim() || executing}
                size="icon"
              >
                {executing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const [expanded, setExpanded] = useState(false)
  const isUser = message.type === 'user'
  const isLong = message.content.length > 300

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2',
          isUser
            ? 'bg-blue-600 text-white'
            : message.status === 'error'
            ? 'bg-red-500/20 border border-red-500/30'
            : 'bg-muted'
        )}
      >
        {/* Message Content */}
        <div className="text-sm whitespace-pre-wrap break-words">
          {isLong && !expanded
            ? message.content.substring(0, 300) + '...'
            : message.content}
        </div>

        {/* Show more/less for long messages */}
        {isLong && (
          <button
            className="text-xs mt-1 opacity-70 hover:opacity-100"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}

        {/* Meta info for assistant messages */}
        {!isUser && message.meta && (message.meta.duration || message.meta.turns) && (
          <div className="flex items-center gap-2 mt-1 text-xs opacity-60">
            {message.meta.duration && message.meta.duration > 0 && (
              <span>{(message.meta.duration / 1000).toFixed(1)}s</span>
            )}
            {message.meta.turns && message.meta.turns > 0 && (
              <span>{message.meta.turns} turns</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
