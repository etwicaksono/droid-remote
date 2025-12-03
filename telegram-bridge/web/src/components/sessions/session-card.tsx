'use client'

import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { Terminal, Loader2, Clock, ChevronDown, ChevronRight, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSessionActions } from '@/hooks/use-session-actions'
import { getSocket } from '@/lib/socket'
import { getAuthHeaders } from '@/lib/api'
import { cn } from '@/lib/utils'
import { InputBox, DEFAULT_MODEL, DEFAULT_REASONING, DEFAULT_AUTONOMY } from '@/components/chat/input-box'
import type { Session, ControlState, ReasoningEffort, QueuedMessage } from '@/types'
import modelsConfig from '@/config/models.json'

// Load models from JSON config file
const AVAILABLE_MODELS = modelsConfig.models as { id: string; name: string; reasoning: boolean }[]
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

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  status?: 'success' | 'error'
  meta?: { duration?: number; turns?: number }
  source?: 'web' | 'cli'
}

// Activity event from stream-json
interface ActivityEvent {
  type: 'message' | 'tool_call' | 'tool_result' | 'raw'
  role?: string
  text?: string
  toolName?: string
  parameters?: Record<string, unknown>
  value?: string
  isError?: boolean
}

export function SessionCard({ session }: SessionCardProps) {
  const [taskPrompt, setTaskPrompt] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [executing, setExecuting] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(DEFAULT_REASONING)
  const [autonomyLevel, setAutonomyLevel] = useState(DEFAULT_AUTONOMY)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [chatOffset, setChatOffset] = useState(0)
  // Local state for real-time updates (pending_request)
  const [pendingRequest, setPendingRequest] = useState(session.pending_request)
  // Real-time activity from droid exec streaming
  const [activityLogs, setActivityLogs] = useState<ActivityEvent[]>([])
  // Queue state
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([])
  const [queueExpanded, setQueueExpanded] = useState(false)
  const { approve, deny, alwaysAllow, executeTask, cancelTask, addChatMessage, getQueue, clearQueue, cancelQueuedMessage, addToQueue } = useSessionActions()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const chatContainerRef = useRef<HTMLDivElement | null>(null)
  const isLoadingOlderRef = useRef(false)

  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel)
  const supportsReasoning = currentModel?.reasoning ?? false

  // Scroll chat to bottom
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [])

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const nextHeight = textarea.scrollHeight
    const clampedHeight = Math.min(nextHeight, MAX_MESSAGE_INPUT_HEIGHT)
    textarea.style.height = `${clampedHeight}px`
    textarea.style.overflowY = nextHeight > MAX_MESSAGE_INPUT_HEIGHT ? 'auto' : 'hidden'
  }, [])

  const CHAT_PAGE_SIZE = 30

  // Parse API message to ChatMessage format
  const parseMessage = (msg: any): ChatMessage => ({
    id: String(msg.id),
    type: msg.type,
    content: msg.content,
    timestamp: new Date(msg.created_at),
    status: msg.status,
    source: msg.source || 'web',
    meta: msg.duration_ms || msg.num_turns ? {
      duration: msg.duration_ms,
      turns: msg.num_turns
    } : undefined
  })

  // Sync local state with session prop changes
  useEffect(() => {
    setPendingRequest(session.pending_request)
  }, [session.pending_request])

  // Listen for sessions_update to get real-time pending_request updates
  useEffect(() => {
    const socket = getSocket()
    
    const handleSessionsUpdate = (sessions: Session[]) => {
      const updated = sessions.find(s => s.id === session.id)
      if (updated) {
        setPendingRequest(updated.pending_request)
      }
    }
    
    socket.on('sessions_update', handleSessionsUpdate)
    return () => {
      socket.off('sessions_update', handleSessionsUpdate)
    }
  }, [session.id])

  // Load queue and listen for updates
  useEffect(() => {
    const loadQueue = async () => {
      try {
        const data = await getQueue({ sessionId: session.id })
        setQueuedMessages(data.messages || [])
      } catch (error) {
        console.error('Failed to load queue:', error)
      }
    }
    
    loadQueue()
    
    const socket = getSocket()
    const handleQueueUpdated = (data: { session_id: string; queue: QueuedMessage[] }) => {
      if (data.session_id === session.id) {
        setQueuedMessages(data.queue || [])
      }
    }
    
    socket.on('queue_updated', handleQueueUpdated)
    return () => {
      socket.off('queue_updated', handleQueueUpdated)
    }
  }, [session.id, getQueue])

  // Load chat history and settings from API on mount
  useEffect(() => {
    // Clear chat history immediately when session changes
    setChatHistory([])
    setSettingsLoaded(false)
    setHasMoreMessages(false)
    setChatOffset(0)
    setExecuting(false)
    
    const loadData = async () => {
      try {
        // Load chat history and settings in parallel
        const [chatRes, settingsRes] = await Promise.all([
          fetch(`${API_BASE}/sessions/${session.id}/chat?limit=${CHAT_PAGE_SIZE}&offset=0`, { headers: getAuthHeaders() }),
          fetch(`${API_BASE}/sessions/${session.id}/settings`, { headers: getAuthHeaders() })
        ])
        
        if (chatRes.ok) {
          const data = await chatRes.json()
          if (data.messages?.length > 0) {
            setChatHistory(data.messages.map(parseMessage))
            setHasMoreMessages(data.has_more || false)
            setChatOffset(data.messages.length)
          } else {
            setChatHistory([])
          }
        }
        
        if (settingsRes.ok) {
          const settings = await settingsRes.json()
          if (settings.model) setSelectedModel(settings.model)
          if (settings.reasoning_effort) setReasoningEffort(settings.reasoning_effort as ReasoningEffort)
          if (settings.autonomy_level) setAutonomyLevel(settings.autonomy_level)
        }
        
        setSettingsLoaded(true)
        
        // Scroll to bottom immediately after chat loads
        setTimeout(scrollToBottom, 50)
        
        // Check cli-thinking in background (don't block UI)
        checkCliThinking(session.id)
      } catch (err) {
        console.error('Failed to load session data:', err)
        setSettingsLoaded(true)
      }
    }
    
    // Background check for CLI thinking state
    const checkCliThinking = async (sessionId: string) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      try {
        const res = await fetch(`${API_BASE}/sessions/${sessionId}/cli-thinking`, {
          signal: controller.signal,
          headers: getAuthHeaders()
        })
        clearTimeout(timeoutId)
        if (res.ok) {
          const data = await res.json()
          if (data.thinking) setExecuting(true)
        }
      } catch {
        // Ignore - non-critical
      }
    }
    
    loadData()
  }, [session.id, scrollToBottom])

  // Load older messages
  const loadOlderMessages = async () => {
    if (loadingMore || !hasMoreMessages) return
    
    isLoadingOlderRef.current = true
    setLoadingMore(true)
    try {
      // Remember scroll position before loading
      const container = chatContainerRef.current
      const scrollHeightBefore = container?.scrollHeight || 0
      const scrollTopBefore = container?.scrollTop || 0
      
      const chatRes = await fetch(`${API_BASE}/sessions/${session.id}/chat?limit=${CHAT_PAGE_SIZE}&offset=${chatOffset}`, { headers: getAuthHeaders() })
      if (chatRes.ok) {
        const data = await chatRes.json()
        if (data.messages?.length > 0) {
          // Prepend older messages
          setChatHistory(prev => [...data.messages.map(parseMessage), ...prev])
          setHasMoreMessages(data.has_more || false)
          setChatOffset(prev => prev + data.messages.length)
          
          // Restore scroll position after DOM updates using requestAnimationFrame
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (container) {
                const scrollHeightAfter = container.scrollHeight
                const heightDiff = scrollHeightAfter - scrollHeightBefore
                container.scrollTop = scrollTopBefore + heightDiff
              }
              isLoadingOlderRef.current = false
            })
          })
        } else {
          isLoadingOlderRef.current = false
        }
      } else {
        isLoadingOlderRef.current = false
      }
    } catch (err) {
      console.error('Failed to load older messages:', err)
      isLoadingOlderRef.current = false
    } finally {
      setLoadingMore(false)
    }
  }

  // Save settings to API when they change (after initial load)
  useEffect(() => {
    if (!settingsLoaded) return
    
    const saveSettings = async () => {
      try {
        const params = new URLSearchParams({
          model: selectedModel,
          reasoning_effort: reasoningEffort,
          autonomy_level: autonomyLevel
        })
        await fetch(`${API_BASE}/sessions/${session.id}/settings?${params}`, {
          method: 'PUT',
          headers: getAuthHeaders()
        })
      } catch {
        // Ignore save errors
      }
    }
    saveSettings()
  }, [selectedModel, reasoningEffort, autonomyLevel, session.id, settingsLoaded])

  // Listen for task events via WebSocket (sync across devices)
  useEffect(() => {
    const socket = getSocket()
    
    const handleTaskStarted = (data: { task_id: string; project_dir: string; session_id?: string }) => {
      // Check if this task is for our session
      if (data.session_id === session.id || data.project_dir === session.project_dir) {
        setExecuting(true)
        setCurrentTaskId(data.task_id)
        setActivityLogs([]) // Clear previous activity
      }
    }
    
    const handleTaskActivity = (data: { task_id: string; session_id?: string; event: ActivityEvent }) => {
      // Check if this is for our session
      if (data.task_id === currentTaskId || data.session_id === session.id) {
        setActivityLogs(prev => [...prev, data.event])
      }
    }
    
    const handleTaskCompleted = async (data: { 
      task_id: string; 
      success: boolean; 
      result: string; 
      session_id?: string;
      duration_ms?: number;
      num_turns?: number;
      error?: string;
    }) => {
      // Check if this is for our session
      if (data.task_id === currentTaskId || data.session_id === session.id) {
        setExecuting(false)
        setCurrentTaskId(null)
        setActivityLogs([]) // Clear activity on completion
        
        // Parse the result to get human-readable content
        const responseContent = parseResultContent(data.result, data.error)
        
        // Save assistant message to database
        try {
          const assistantResponse = await addChatMessage({
            sessionId: session.id,
            type: 'assistant',
            content: responseContent,
            status: data.success ? 'success' : 'error',
            durationMs: data.duration_ms,
            numTurns: data.num_turns,
          })
          // Add assistant message with DB-assigned ID
          if (assistantResponse?.message) {
            const assistantMessage: ChatMessage = {
              id: String(assistantResponse.message.id),
              type: 'assistant',
              content: responseContent,
              timestamp: new Date(assistantResponse.message.created_at || Date.now()),
              status: data.success ? 'success' : 'error',
              source: 'web',
              meta: data.duration_ms || data.num_turns ? {
                duration: data.duration_ms,
                turns: data.num_turns,
              } : undefined,
            }
            setChatHistory(prev => {
              if (prev.some(msg => msg.id === assistantMessage.id)) return prev
              return [...prev, assistantMessage]
            })
          }
        } catch {
          // If API fails, add message to local state with temp ID
          const assistantMessage: ChatMessage = {
            id: `temp-${Date.now()}`,
            type: 'assistant',
            content: responseContent,
            timestamp: new Date(),
            status: data.success ? 'success' : 'error',
            source: 'web',
            meta: data.duration_ms || data.num_turns ? {
              duration: data.duration_ms,
              turns: data.num_turns,
            } : undefined,
          }
          setChatHistory(prev => [...prev, assistantMessage])
        }
      }
    }
    
    const handleTaskCancelled = (data: { task_id: string }) => {
      if (data.task_id === currentTaskId) {
        setExecuting(false)
        setCurrentTaskId(null)
      }
    }
    
    const handleChatUpdated = (data: { session_id: string; message: any }) => {
      // Check if this is for our session
      if (data.session_id === session.id) {
        const newMessage: ChatMessage = {
          id: String(data.message.id),
          type: data.message.type as 'user' | 'assistant',
          content: data.message.content,
          timestamp: new Date(data.message.created_at),
          status: data.message.status,
          source: data.message.source || 'cli',
          meta: data.message.duration_ms || data.message.num_turns ? {
            duration: data.message.duration_ms,
            turns: data.message.num_turns
          } : undefined
        }
        // Add message if not already in history (avoid duplicates)
        setChatHistory(prev => {
          if (prev.some(msg => msg.id === newMessage.id)) return prev
          return [...prev, newMessage]
        })
        
        // If assistant message from CLI, clear thinking state
        if (newMessage.type === 'assistant' && newMessage.source === 'cli') {
          setExecuting(false)
          setCurrentTaskId(null)
        }
      }
    }
    
    const handleCliThinking = (data: { session_id: string; prompt: string }) => {
      if (data.session_id === session.id) {
        setExecuting(true)
      }
    }
    
    const handleCliThinkingDone = (data: { session_id: string }) => {
      if (data.session_id === session.id) {
        setExecuting(false)
        setCurrentTaskId(null)
      }
    }
    
    socket.on('task_started', handleTaskStarted)
    socket.on('task_activity', handleTaskActivity)
    socket.on('task_completed', handleTaskCompleted)
    socket.on('task_cancelled', handleTaskCancelled)
    socket.on('chat_updated', handleChatUpdated)
    socket.on('cli_thinking', handleCliThinking)
    socket.on('cli_thinking_done', handleCliThinkingDone)
    
    return () => {
      socket.off('task_started', handleTaskStarted)
      socket.off('task_activity', handleTaskActivity)
      socket.off('task_completed', handleTaskCompleted)
      socket.off('task_cancelled', handleTaskCancelled)
      socket.off('chat_updated', handleChatUpdated)
      socket.off('cli_thinking', handleCliThinking)
      socket.off('cli_thinking_done', handleCliThinkingDone)
    }
  }, [session.project_dir, session.id, currentTaskId, addChatMessage])

  // Scroll to bottom when chat history changes or executing state changes (but not when loading older messages)
  useEffect(() => {
    if (!isLoadingOlderRef.current) {
      // Small delay to ensure DOM has updated
      setTimeout(scrollToBottom, 50)
    }
  }, [chatHistory, executing, scrollToBottom])

  const hasPendingRequest = pendingRequest !== null

  const handleTaskSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!taskPrompt.trim() || executing) return

    const prompt = taskPrompt.trim()
    
    // Generate task_id immediately for cancellation tracking
    const taskId = generateUUID()
    
    setTaskPrompt('')
    setExecuting(true)
    setCurrentTaskId(taskId) // Set immediately before execution

    // Save user message to API and add to local state immediately
    try {
      const response = await addChatMessage({
        sessionId: session.id,
        type: 'user',
        content: prompt,
      })
      // Add user message with DB-assigned ID immediately
      if (response?.message) {
        const userMessage: ChatMessage = {
          id: String(response.message.id),
          type: 'user',
          content: prompt,
          timestamp: new Date(response.message.created_at || Date.now()),
        }
        setChatHistory(prev => {
          if (prev.some(msg => msg.id === userMessage.id)) return prev
          return [...prev, userMessage]
        })
      }
    } catch (error) {
      // If API fails, add message to local state with temp ID
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        type: 'user',
        content: prompt,
        timestamp: new Date(),
      }
      setChatHistory(prev => [...prev, userMessage])
    }

    // Execute task in background - result will come via WebSocket
    try {
      await executeTask({
        prompt,
        projectDir: session.project_dir,
        taskId: taskId,
        sessionId: session.id,
        model: selectedModel,
        reasoningEffort: supportsReasoning ? reasoningEffort : undefined,
        autonomyLevel,
      })
      // Task started successfully - WebSocket 'task_completed' will handle the result
    } catch (error) {
      // Network error or immediate failure - show error
      const errorContent = String(error)
      setExecuting(false)
      setCurrentTaskId(null)
      
      // Save error message to API and add to local state
      try {
        const errorResponse = await addChatMessage({
          sessionId: session.id,
          type: 'assistant',
          content: errorContent,
          status: 'error',
        })
        if (errorResponse?.message) {
          const errorMessage: ChatMessage = {
            id: String(errorResponse.message.id),
            type: 'assistant',
            content: errorContent,
            timestamp: new Date(errorResponse.message.created_at || Date.now()),
            status: 'error',
          }
          setChatHistory(prev => {
            if (prev.some(msg => msg.id === errorMessage.id)) return prev
            return [...prev, errorMessage]
          })
        }
      } catch {
        // If API also fails, add message to local state with temp ID
        const errorMessage: ChatMessage = {
          id: `temp-${Date.now() + 1}`,
          type: 'assistant',
          content: errorContent,
          timestamp: new Date(),
          status: 'error',
        }
        setChatHistory(prev => [...prev, errorMessage])
      }
    }
  }

  const handleCancelTask = async () => {
    if (!currentTaskId) return
    
    try {
      await cancelTask(currentTaskId)
      
      // Save cancel message to API and add to local state
      try {
        const cancelResponse = await addChatMessage({
          sessionId: session.id,
          type: 'assistant',
          content: 'Task cancelled by user',
          status: 'error',
        })
        if (cancelResponse?.message) {
          const cancelMessage: ChatMessage = {
            id: String(cancelResponse.message.id),
            type: 'assistant',
            content: 'Task cancelled by user',
            timestamp: new Date(cancelResponse.message.created_at || Date.now()),
            status: 'error',
          }
          setChatHistory(prev => {
            if (prev.some(msg => msg.id === cancelMessage.id)) return prev
            return [...prev, cancelMessage]
          })
        }
      } catch {
        // If API fails, add message to local state with temp ID
        const cancelMessage: ChatMessage = {
          id: `temp-${Date.now() + 1}`,
          type: 'assistant',
          content: 'Task cancelled by user',
          timestamp: new Date(),
          status: 'error',
        }
        setChatHistory(prev => [...prev, cancelMessage])
      }
    } catch (error) {
      console.error('Failed to cancel task:', error)
    } finally {
      setExecuting(false)
      setCurrentTaskId(null)
    }
  }

  const handleApprove = () => {
    if (pendingRequest) {
      approve({ sessionId: session.id })
    }
  }

  const handleDeny = () => {
    if (pendingRequest) {
      deny({ sessionId: session.id })
    }
  }

  const handleAlwaysAllow = () => {
    if (pendingRequest) {
      alwaysAllow({ sessionId: session.id })
    }
  }

  const handleCancelQueueItem = async (messageId: number) => {
    try {
      await cancelQueuedMessage({ sessionId: session.id, messageId })
    } catch (error) {
      console.error('Failed to cancel queued message:', error)
    }
  }

  const handleClearQueue = async () => {
    try {
      await clearQueue({ sessionId: session.id })
    } catch (error) {
      console.error('Failed to clear queue:', error)
    }
  }

  const handleAddToQueue = async () => {
    if (!taskPrompt.trim()) return
    
    try {
      await addToQueue({ sessionId: session.id, content: taskPrompt.trim() })
      setTaskPrompt('')
    } catch (error) {
      console.error('Failed to add to queue:', error)
    }
  }

  // Check if CLI is busy (should show queue mode)
  const isCliBusy = session.control_state === 'cli_active'

  useEffect(() => {
    adjustTextareaHeight()
  }, [taskPrompt, adjustTextareaHeight])

  return (
    <Card className="overflow-hidden flex flex-col h-full relative">
      <CardContent className="flex-1 flex flex-col space-y-3 overflow-hidden pt-0">
        {/* Pending Request */}
        {hasPendingRequest && pendingRequest && (
          <div className="rounded-md bg-yellow-500/20 border border-yellow-500/40 p-3 shrink-0 max-h-[30vh] overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">{pendingRequest.message}</p>

            {pendingRequest.tool_name && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Terminal className="h-3 w-3" />
                <code>{pendingRequest.tool_name}</code>
              </div>
            )}

            {pendingRequest.type === 'permission' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={handleApprove}>
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={handleDeny}>
                  Deny
                </Button>
                <Button size="sm" variant="outline" onClick={handleAlwaysAllow} title="Approve and add to allowlist">
                  Always Allow
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Queue Panel */}
        {queuedMessages.length > 0 && (
          <div className="rounded-md bg-muted/50 border border-border shrink-0">
            <button
              onClick={() => setQueueExpanded(!queueExpanded)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/80 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {queueExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Clock className="h-4 w-4 text-yellow-500" />
                <span>Queued Tasks ({queuedMessages.length})</span>
              </div>
              {queueExpanded && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClearQueue()
                  }}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
              )}
            </button>
            {queueExpanded && (
              <div className="border-t border-border p-2 space-y-1 max-h-[200px] overflow-y-auto">
                {queuedMessages.map((msg, index) => (
                  <div
                    key={msg.id}
                    className="flex items-start gap-2 p-2 rounded bg-background/50 group"
                  >
                    <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">
                      {index + 1}.
                    </span>
                    <p className="flex-1 text-sm truncate" title={msg.content}>
                      {msg.content}
                    </p>
                    <button
                      onClick={() => handleCancelQueueItem(msg.id)}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
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
                  How can I help you?
                </h2>
              </div>

              {/* Centered Input Box */}
              <div className="w-full max-w-2xl">
                <InputBox
                  executing={executing}
                  taskPrompt={taskPrompt}
                  setTaskPrompt={setTaskPrompt}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  reasoningEffort={reasoningEffort}
                  setReasoningEffort={setReasoningEffort}
                  autonomyLevel={autonomyLevel}
                  setAutonomyLevel={setAutonomyLevel}
                  onSubmit={handleTaskSubmit}
                  onCancel={handleCancelTask}
                  textareaRef={textareaRef}
                  queueMode={isCliBusy}
                  onQueue={handleAddToQueue}
                />
                {isCliBusy && (
                  <p className="text-xs text-yellow-500 mt-2 text-center">
                    CLI is processing. New tasks will be queued.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Chat History - scrollable area */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 min-h-0 pb-3">
                {/* Load older messages button */}
                {hasMoreMessages && (
                  <div className="flex justify-center py-2">
                    <button
                      onClick={loadOlderMessages}
                      disabled={loadingMore}
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        '↑ Load older messages'
                      )}
                    </button>
                  </div>
                )}
                {chatHistory.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}
                {executing && (
                  <div className="flex justify-start ms-2">
                    <div className="bg-muted rounded-lg px-3 py-2 max-w-[90%] sm:max-w-[85%]">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        <span>Droid is thinking...</span>
                      </div>
                      {/* Real-time activity logs */}
                      {activityLogs.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50 space-y-1 text-xs">
                          {activityLogs.slice(-5).map((event, idx) => (
                            <div key={idx} className="text-muted-foreground">
                              {event.type === 'tool_call' && (
                                <span className="flex items-center gap-1">
                                  <Terminal className="h-3 w-3 text-blue-400" />
                                  <span className="text-blue-400">{event.toolName}</span>
                                  {event.parameters && 'command' in event.parameters && (
                                    <code className="ml-1 text-[10px] bg-background/50 px-1 rounded truncate max-w-[200px]">
                                      {String(event.parameters.command).slice(0, 50)}
                                    </code>
                                  )}
                                  {event.parameters && 'file_path' in event.parameters && (
                                    <code className="ml-1 text-[10px] bg-background/50 px-1 rounded truncate max-w-[200px]">
                                      {String(event.parameters.file_path).split(/[/\\]/).pop()}
                                    </code>
                                  )}
                                </span>
                              )}
                              {event.type === 'tool_result' && (
                                <span className={cn(
                                  "flex items-center gap-1",
                                  event.isError ? "text-red-400" : "text-green-400"
                                )}>
                                  {event.isError ? '✗' : '✓'} Result received
                                </span>
                              )}
                              {event.type === 'message' && event.role === 'assistant' && event.text && (
                                <span className="text-foreground/70 line-clamp-2">
                                  {event.text.slice(0, 100)}{event.text.length > 100 ? '...' : ''}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Input Box */}
              <div className="shrink-0 pt-3 border-t border-border">
                <InputBox
                  executing={executing}
                  taskPrompt={taskPrompt}
                  setTaskPrompt={setTaskPrompt}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  reasoningEffort={reasoningEffort}
                  setReasoningEffort={setReasoningEffort}
                  autonomyLevel={autonomyLevel}
                  setAutonomyLevel={setAutonomyLevel}
                  onSubmit={handleTaskSubmit}
                  onCancel={handleCancelTask}
                  textareaRef={textareaRef}
                  compact
                  queueMode={isCliBusy}
                  onQueue={handleAddToQueue}
                />
                {isCliBusy && (
                  <p className="text-xs text-yellow-500 mt-2">
                    CLI is processing. New tasks will be queued.
                  </p>
                )}
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
  const [showTimestamp, setShowTimestamp] = useState(false)
  const isUser = message.type === 'user'
  const isLong = message.content.length > 300

  const formattedTime = message.timestamp.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className={cn('flex', isUser ? 'justify-end me-2' : 'justify-start ms-2')}>
      <div
        className={cn(
          'max-w-[90%] sm:max-w-[85%] rounded-lg px-3 py-2 group relative',
          isUser
            ? 'bg-blue-600 text-white'
            : message.status === 'error'
            ? 'bg-red-500/20 border border-red-500/30'
            : 'bg-muted'
        )}
        onClick={() => setShowTimestamp(prev => !prev)}
        title={formattedTime}
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
        {!isUser && (message.meta || message.source) && (
          <div className="flex items-center gap-2 mt-1 text-xs opacity-60">
            {message.source === 'cli' && (
              <span className="px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">CLI</span>
            )}
            {message.meta?.duration && message.meta.duration > 0 && (
              <span>{(message.meta.duration / 1000).toFixed(1)}s</span>
            )}
            {message.meta?.turns && message.meta.turns > 0 && (
              <span>{message.meta.turns} turns</span>
            )}
          </div>
        )}
        
        {/* Source indicator for user messages */}
        {isUser && message.source === 'cli' && (
          <div className="flex justify-end mt-1">
            <span className="px-1 py-0.5 bg-white/20 rounded text-[10px]">CLI</span>
          </div>
        )}

        {/* Timestamp - visible on hover (desktop) or click (mobile) */}
        <div className={cn(
          'text-[10px] mt-1 transition-opacity duration-200',
          isUser ? 'text-white/60' : 'text-muted-foreground',
          'sm:opacity-0 sm:group-hover:opacity-100',
          showTimestamp ? 'opacity-100' : 'opacity-0 sm:opacity-0'
        )}>
          {formattedTime}
        </div>
      </div>
    </div>
  )
}




