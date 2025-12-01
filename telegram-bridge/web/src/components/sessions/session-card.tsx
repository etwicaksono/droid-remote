'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Clock, Folder, Terminal, Radio, Play, Square, Loader2, Settings2, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useSessionActions } from '@/hooks/use-session-actions'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Session, ControlState, ReasoningEffort } from '@/types'

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', reasoning: true },
  { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', reasoning: false },
  { id: 'gpt-5.1', name: 'GPT-5.1', reasoning: true },
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', reasoning: true },
  { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', reasoning: true },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', reasoning: true },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', reasoning: false },
  { id: 'glm-4.6', name: 'Droid Core', reasoning: false },
]

const REASONING_LEVELS: { id: ReasoningEffort; name: string }[] = [
  { id: 'off', name: 'Off' },
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' },
]

// Helper to parse droid exec result and extract clean content
function parseResultContent(resultStr: string | undefined, error: string | undefined): string {
  if (error) return error
  if (!resultStr) return 'Task completed'
  
  let content = resultStr
  
  // Try to parse JSON (droid exec returns JSON with --output-format json)
  if (content.startsWith('{') || content.startsWith('[')) {
    try {
      const parsed = JSON.parse(content)
      // Handle droid exec JSON format: {type, subtype, result, ...}
      if (parsed.result !== undefined) {
        content = String(parsed.result)
      } else if (parsed.message) {
        content = parsed.message
      } else if (parsed.error) {
        content = parsed.error
      }
    } catch {
      // Not valid JSON, keep as-is
    }
  }
  
  // Clean up markdown headers like "# Answer\n\n"
  content = content.replace(/^#\s*Answer\s*\n+/i, '').trim()
  
  // Remove duplicate content (sometimes appears twice)
  const lines = content.split('\n')
  if (lines.length > 6) {
    const mid = Math.floor(lines.length / 2)
    const first = lines.slice(0, mid).join('\n').trim()
    const second = lines.slice(mid).join('\n').trim()
    if (first === second) content = first
  }
  
  return content || 'Task completed'
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

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
  const [showSettings, setShowSettings] = useState(false)
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929')
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('medium')
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const { respond, approve, deny, handoff, release, executeTask, addChatMessage, loading } = useSessionActions()

  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel)
  const supportsReasoning = currentModel?.reasoning ?? false

  // Load chat history and settings from API on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load chat history
        const chatRes = await fetch(`${API_BASE}/sessions/${session.id}/chat`)
        if (chatRes.ok) {
          const data = await chatRes.json()
          if (data.messages?.length > 0) {
            setChatHistory(data.messages.map((msg: any) => ({
              id: String(msg.id),
              type: msg.type,
              content: msg.content,
              timestamp: new Date(msg.created_at),
              status: msg.status,
              meta: msg.duration_ms || msg.num_turns ? {
                duration: msg.duration_ms,
                turns: msg.num_turns
              } : undefined
            })))
          }
        }
        
        // Load settings
        const settingsRes = await fetch(`${API_BASE}/sessions/${session.id}/settings`)
        if (settingsRes.ok) {
          const settings = await settingsRes.json()
          if (settings.model) setSelectedModel(settings.model)
          if (settings.reasoning_effort) setReasoningEffort(settings.reasoning_effort as ReasoningEffort)
        }
        setSettingsLoaded(true)
      } catch (err) {
        console.error('Failed to load session data:', err)
        setSettingsLoaded(true)
      }
    }
    loadData()
  }, [session.id])

  // Save settings to API when they change (after initial load)
  useEffect(() => {
    if (!settingsLoaded) return
    
    const saveSettings = async () => {
      try {
        const params = new URLSearchParams({
          model: selectedModel,
          reasoning_effort: reasoningEffort
        })
        await fetch(`${API_BASE}/sessions/${session.id}/settings?${params}`, {
          method: 'PUT'
        })
      } catch {
        // Ignore save errors
      }
    }
    saveSettings()
  }, [selectedModel, reasoningEffort, session.id, settingsLoaded])

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

    const prompt = taskPrompt.trim()
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt,
      timestamp: new Date(),
    }
    setChatHistory(prev => [...prev, userMessage])
    setTaskPrompt('')
    setExecuting(true)

    // Save user message to API
    try {
      await addChatMessage({
        sessionId: session.id,
        type: 'user',
        content: prompt,
      })
    } catch {}

    try {
      const result = await executeTask({
        prompt,
        projectDir: session.project_dir,
        sessionId: session.id,
        model: selectedModel,
        reasoningEffort: supportsReasoning ? reasoningEffort : undefined,
      })
      
      // Parse the result to get human-readable content
      const responseContent = parseResultContent(result.result, result.error)

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

      // Save assistant message to API
      try {
        await addChatMessage({
          sessionId: session.id,
          type: 'assistant',
          content: responseContent,
          status: result.success ? 'success' : 'error',
          durationMs: result.duration_ms,
          numTurns: result.num_turns,
        })
      } catch {}
    } catch (error) {
      const errorContent = String(error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: errorContent,
        timestamp: new Date(),
        status: 'error',
      }
      setChatHistory(prev => [...prev, errorMessage])

      // Save error message to API
      try {
        await addChatMessage({
          sessionId: session.id,
          type: 'assistant',
          content: errorContent,
          status: 'error',
        })
      } catch {}
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
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
          <span className={cn('h-2 w-2 rounded-full shrink-0', statusConfig.color)} />
          <span className="font-semibold truncate">{session.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            <Radio className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">{controlConfig.label}</span>
            <span className="sm:hidden">{controlConfig.label.split(' ')[0]}</span>
          </Badge>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-x-4 sm:gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <Folder className="h-3 w-3 shrink-0" />
            <span className="truncate">{session.project_dir}</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            {formatRelativeTime(session.last_activity)}
          </span>
        </div>

        {/* Control State Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
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
            {/* Settings Bar */}
            <div className="flex items-center gap-2 text-xs">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings2 className="h-3 w-3 mr-1" />
                {currentModel?.name || 'Model'}
                {supportsReasoning && reasoningEffort !== 'off' && (
                  <Brain className="h-3 w-3 ml-1 text-purple-400" />
                )}
              </Button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div className="p-3 rounded-md bg-muted/50 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full h-8 px-2 text-sm rounded-md bg-background border border-border"
                  >
                    {AVAILABLE_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} {model.reasoning ? '(thinking)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                {supportsReasoning && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <Brain className="h-3 w-3" />
                      Thinking Mode
                    </label>
                    <div className="flex gap-1">
                      {REASONING_LEVELS.map((level) => (
                        <Button
                          key={level.id}
                          size="sm"
                          variant={reasoningEffort === level.id ? 'default' : 'outline'}
                          className="h-7 px-2 text-xs flex-1"
                          onClick={() => setReasoningEffort(level.id)}
                        >
                          {level.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chat History */}
            {(chatHistory.length > 0 || executing) && (
              <div className="space-y-3 max-h-80 overflow-y-auto overflow-x-hidden">
                {chatHistory.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}
                {executing && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Droid is thinking...
                    </div>
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
          'max-w-[90%] sm:max-w-[85%] rounded-lg px-3 py-2',
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
