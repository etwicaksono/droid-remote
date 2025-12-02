'use client'

import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { Clock, Folder, Terminal, Radio, Play, Square, Loader2, Copy, Check, Plus, Settings, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useSessionActions } from '@/hooks/use-session-actions'
import { getSocket } from '@/lib/socket'
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

const MAX_MESSAGE_INPUT_HEIGHT = 240

// Generate UUID that works in all browsers (crypto.randomUUID requires HTTPS)
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for non-secure contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

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
  const [taskPrompt, setTaskPrompt] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [executing, setExecuting] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929')
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('medium')
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [copiedSessionId, setCopiedSessionId] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [controlAction, setControlAction] = useState<'handoff' | 'release' | null>(null)
  const { approve, deny, handoff, release, executeTask, cancelTask, addChatMessage, loading } = useSessionActions()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel)
  const supportsReasoning = currentModel?.reasoning ?? false

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const nextHeight = textarea.scrollHeight
    const clampedHeight = Math.min(nextHeight, MAX_MESSAGE_INPUT_HEIGHT)
    textarea.style.height = `${clampedHeight}px`
    textarea.style.overflowY = nextHeight > MAX_MESSAGE_INPUT_HEIGHT ? 'auto' : 'hidden'
  }, [])

  // Load chat history and settings from API on mount
  useEffect(() => {
    // Clear chat history immediately when session changes
    setChatHistory([])
    setSettingsLoaded(false)
    
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
          } else {
            setChatHistory([])
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

  // Listen for task events via WebSocket (sync across devices)
  useEffect(() => {
    const socket = getSocket()
    
    const handleTaskStarted = (data: { task_id: string; project_dir: string; session_id?: string }) => {
      // Check if this task is for our session
      if (data.session_id === session.id || data.project_dir === session.project_dir) {
        setExecuting(true)
        setCurrentTaskId(data.task_id)
      }
    }
    
    const handleTaskCompleted = async (data: { task_id: string; success: boolean; result: string; session_id?: string }) => {
      // Check if this is for our session
      if (data.task_id === currentTaskId || data.session_id === session.id) {
        setExecuting(false)
        setCurrentTaskId(null)
        
        // Refresh chat history to get the latest messages (for other devices)
        try {
          const chatRes = await fetch(`${API_BASE}/sessions/${session.id}/chat`)
          if (chatRes.ok) {
            const messages = await chatRes.json()
            setChatHistory(messages.map((msg: { id: string; type: string; content: string; created_at: string }) => ({
              id: msg.id,
              type: msg.type as 'user' | 'assistant',
              content: msg.content,
              timestamp: new Date(msg.created_at),
            })))
          }
        } catch {
          // Ignore fetch errors
        }
      }
    }
    
    const handleTaskCancelled = (data: { task_id: string }) => {
      if (data.task_id === currentTaskId) {
        setExecuting(false)
        setCurrentTaskId(null)
      }
    }
    
    socket.on('task_started', handleTaskStarted)
    socket.on('task_completed', handleTaskCompleted)
    socket.on('task_cancelled', handleTaskCancelled)
    
    return () => {
      socket.off('task_started', handleTaskStarted)
      socket.off('task_completed', handleTaskCompleted)
      socket.off('task_cancelled', handleTaskCancelled)
    }
  }, [session.project_dir, session.id, currentTaskId])

  const statusConfig = STATUS_CONFIG[session.status]
  const controlState = session.control_state || 'cli_active'
  const controlConfig = CONTROL_STATE_CONFIG[controlState]
  const hasPendingRequest = session.pending_request !== null
  const isRemoteControlled = controlState === 'remote_active'
  const canHandoff = controlState === 'cli_active' || controlState === 'cli_waiting' || controlState === 'released'

  const handleTaskSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!taskPrompt.trim() || executing) return

    const prompt = taskPrompt.trim()
    
    // Generate task_id immediately for cancellation tracking
    const taskId = generateUUID()
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt,
      timestamp: new Date(),
    }
    setChatHistory(prev => [...prev, userMessage])
    setTaskPrompt('')
    setExecuting(true)
    setCurrentTaskId(taskId) // Set immediately before execution

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
        taskId: taskId,
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
      setCurrentTaskId(null)
    }
  }

  const handleCancelTask = async () => {
    if (!currentTaskId) return
    
    try {
      await cancelTask(currentTaskId)
      
      const cancelMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Task cancelled by user',
        timestamp: new Date(),
        status: 'error',
      }
      setChatHistory(prev => [...prev, cancelMessage])
      
      // Save cancel message to API
      try {
        await addChatMessage({
          sessionId: session.id,
          type: 'assistant',
          content: 'Task cancelled by user',
          status: 'error',
        })
      } catch {}
    } catch (error) {
      console.error('Failed to cancel task:', error)
    } finally {
      setExecuting(false)
      setCurrentTaskId(null)
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
    setActionError(null)
    setControlAction('handoff')
    try {
      const result = await handoff({ sessionId: session.id })
      if (!result.success) {
        setActionError(result.error || 'Failed to take control')
        setControlAction(null) // Clear on error only
      }
      // Don't clear controlAction on success - wait for state change
    } catch (error) {
      console.error('Handoff failed:', error)
      setActionError(error instanceof Error ? error.message : 'Failed to take control')
      setControlAction(null) // Clear on error only
    }
  }

  const handleRelease = async () => {
    setControlAction('release')
    try {
      await release({ sessionId: session.id })
      // Don't clear controlAction on success - wait for state change
    } catch (error) {
      console.error('Release failed:', error)
      setControlAction(null) // Clear on error only
    }
  }

  // Clear loading overlay when control state actually changes
  useEffect(() => {
    if (controlAction) {
      // If we were taking control and now we're remote_active, clear
      if (controlAction === 'handoff' && controlState === 'remote_active') {
        setControlAction(null)
      }
      // If we were releasing and now we're not remote_active, clear
      if (controlAction === 'release' && controlState !== 'remote_active') {
        setControlAction(null)
      }
    }
  }, [controlState, controlAction])

  useEffect(() => {
    if (!isRemoteControlled) return
    adjustTextareaHeight()
  }, [taskPrompt, isRemoteControlled, adjustTextareaHeight])

  const handleCopySessionId = async () => {
    try {
      await navigator.clipboard.writeText(session.id)
      setCopiedSessionId(true)
      setTimeout(() => setCopiedSessionId(false), 2000)
    } catch (error) {
      console.error('Failed to copy session ID:', error)
    }
  }

  return (
    <Card className="overflow-hidden flex flex-col h-full relative">
      {/* Loading Overlay for Control Actions */}
      {controlAction && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 className="h-10 w-10 animate-spin" />
            <span className="text-lg font-medium">
              {controlAction === 'handoff' ? 'Taking control...' : 'Releasing to CLI...'}
            </span>
          </div>
        </div>
      )}
      
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2 shrink-0">
        <div className="flex flex-col gap-1 min-w-0 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full shrink-0', statusConfig.color)} />
            <span className="font-semibold truncate">{session.name}</span>
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground pl-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs select-all">
                {session.id}
              </span>
              <button
                onClick={handleCopySessionId}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
                title="Copy session ID"
              >
                {copiedSessionId ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
            <span className="truncate" title={session.project_dir}>
              📁 {session.project_dir}
            </span>
          </div>
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

      <CardContent className="flex-1 flex flex-col space-y-3 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-x-4 sm:gap-y-1 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1 truncate">
            <Folder className="h-3 w-3 shrink-0" />
            <span className="truncate">{session.project_dir}</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            {formatRelativeTime(session.last_activity)}
          </span>
        </div>

        {/* Pending Request */}
        {hasPendingRequest && session.pending_request && (
          <div className="rounded-md bg-muted p-3 shrink-0">
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

        {/* Chat Area */}
        <div className="flex-1 flex flex-col pt-2 border-t border-border min-h-0 overflow-hidden">
          {/* Empty State - Centered Welcome */}
          {chatHistory.length === 0 && !executing ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              {/* Welcome Message */}
              <div className="text-center mb-6">
                <span className="text-3xl sm:text-4xl">🤖</span>
                <h2 className="text-xl sm:text-2xl font-light text-muted-foreground mt-2">
                  {isRemoteControlled ? 'How can I help you?' : 'Ready to assist'}
                </h2>
              </div>

              {/* Centered Input Box */}
              <div className="w-full max-w-2xl">
                <InputBox
                  isRemoteControlled={isRemoteControlled}
                  canHandoff={canHandoff}
                  executing={executing}
                  loading={loading}
                  taskPrompt={taskPrompt}
                  setTaskPrompt={setTaskPrompt}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  reasoningEffort={reasoningEffort}
                  setReasoningEffort={setReasoningEffort}
                  supportsReasoning={supportsReasoning}
                  textareaRef={textareaRef}
                  onSubmit={handleTaskSubmit}
                  onCancel={handleCancelTask}
                  onHandoff={handleHandoff}
                  onRelease={handleRelease}
                  actionError={actionError}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Chat History - scrollable area */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 min-h-0 pb-3">
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

              {/* Bottom Input Box */}
              <div className="shrink-0 pt-3 border-t border-border">
                <InputBox
                  isRemoteControlled={isRemoteControlled}
                  canHandoff={canHandoff}
                  executing={executing}
                  loading={loading}
                  taskPrompt={taskPrompt}
                  setTaskPrompt={setTaskPrompt}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  reasoningEffort={reasoningEffort}
                  setReasoningEffort={setReasoningEffort}
                  supportsReasoning={supportsReasoning}
                  textareaRef={textareaRef}
                  onSubmit={handleTaskSubmit}
                  onCancel={handleCancelTask}
                  onHandoff={handleHandoff}
                  onRelease={handleRelease}
                  actionError={actionError}
                  compact
                />
              </div>
            </>
          )}
        </div>
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

interface InputBoxProps {
  isRemoteControlled: boolean
  canHandoff: boolean
  executing: boolean
  loading: boolean
  taskPrompt: string
  setTaskPrompt: (value: string) => void
  selectedModel: string
  setSelectedModel: (value: string) => void
  reasoningEffort: ReasoningEffort
  setReasoningEffort: (value: ReasoningEffort) => void
  supportsReasoning: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  onHandoff: () => void
  onRelease: () => void
  actionError: string | null
  compact?: boolean
}

function InputBox({
  isRemoteControlled,
  canHandoff,
  executing,
  loading,
  taskPrompt,
  setTaskPrompt,
  selectedModel,
  setSelectedModel,
  reasoningEffort,
  setReasoningEffort,
  supportsReasoning,
  textareaRef,
  onSubmit,
  onCancel,
  onHandoff,
  onRelease,
  actionError,
  compact = false,
}: InputBoxProps) {
  const disabled = !isRemoteControlled

  return (
    <div className="space-y-2">
      {/* Input Container */}
      <form onSubmit={onSubmit} className="rounded-xl bg-muted/50 border border-border overflow-hidden">
        {/* Text Input */}
        <Textarea
          ref={textareaRef}
          placeholder={isRemoteControlled ? "How can I help you today?" : "Take control to send messages..."}
          rows={compact ? 1 : 2}
          value={taskPrompt}
          onChange={(e) => setTaskPrompt(e.target.value)}
          disabled={disabled || executing}
          className={cn(
            "w-full border-0 bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0",
            compact ? "min-h-[40px] py-3 px-4" : "min-h-[60px] py-4 px-4",
            disabled && "opacity-50"
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (taskPrompt.trim() && !executing && isRemoteControlled) {
                onSubmit(e as unknown as FormEvent<HTMLFormElement>)
              }
            }
          }}
          style={{ maxHeight: `${MAX_MESSAGE_INPUT_HEIGHT}px` }}
        />

        {/* Toolbar */}
        <div className={cn(
          "flex items-center justify-between px-3 pb-3",
          disabled && "opacity-50"
        )}>
          {/* Left side - Action buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              title="Attach file (coming soon)"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* Right side - Model selector, Thinking, Send */}
          <div className="flex items-center gap-2">
            {/* Model Selector */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={disabled || executing}
              className={cn(
                "h-8 px-2 text-xs rounded-lg bg-transparent border-0 hover:bg-muted transition-colors cursor-pointer",
                "focus:outline-none focus:ring-0",
                disabled && "cursor-not-allowed"
              )}
            >
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>

            {/* Thinking Mode - Only show if model supports it */}
            {supportsReasoning && (
              <select
                value={reasoningEffort}
                onChange={(e) => setReasoningEffort(e.target.value as ReasoningEffort)}
                disabled={disabled || executing}
                className={cn(
                  "h-8 px-2 text-xs rounded-lg bg-transparent border-0 hover:bg-muted transition-colors cursor-pointer",
                  "focus:outline-none focus:ring-0",
                  disabled && "cursor-not-allowed"
                )}
                title="Thinking mode"
              >
                {REASONING_LEVELS.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            )}

            {/* Send/Cancel Button */}
            {executing ? (
              <Button
                type="button"
                onClick={onCancel}
                size="icon"
                variant="destructive"
                className="h-8 w-8 rounded-full shrink-0"
                title="Cancel task"
              >
                <Square className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={disabled || !taskPrompt.trim()}
                size="icon"
                className="h-8 w-8 rounded-full shrink-0 bg-orange-600 hover:bg-orange-700"
                title="Send message"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Error message */}
      {actionError && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
          {actionError}
        </div>
      )}

      {/* Control Button */}
      <div className="flex gap-2">
        {isRemoteControlled ? (
          <Button onClick={onRelease} disabled={loading} variant="outline" className="flex-1">
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Square className="h-4 w-4 mr-2" />
            )}
            <span className="hidden sm:inline">{loading ? 'Releasing...' : 'Release to CLI'}</span>
            <span className="sm:hidden">{loading ? '...' : 'Release'}</span>
          </Button>
        ) : canHandoff ? (
          <Button onClick={onHandoff} disabled={loading} className="flex-1">
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            <span className="hidden sm:inline">{loading ? 'Taking control...' : 'Take Control'}</span>
            <span className="sm:hidden">{loading ? '...' : 'Control'}</span>
          </Button>
        ) : (
          <div className="flex-1 h-10 flex items-center justify-center text-sm text-muted-foreground bg-muted rounded-md">
            CLI is active
          </div>
        )}
      </div>
    </div>
  )
}
