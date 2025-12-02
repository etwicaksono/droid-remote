'use client'

import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { Terminal, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSessionActions } from '@/hooks/use-session-actions'
import { getSocket } from '@/lib/socket'
import { cn } from '@/lib/utils'
import { InputBox, DEFAULT_MODEL, DEFAULT_REASONING } from '@/components/chat/input-box'
import type { Session, ControlState, ReasoningEffort } from '@/types'
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

export function SessionCard({ session }: SessionCardProps) {
  const [taskPrompt, setTaskPrompt] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [executing, setExecuting] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(DEFAULT_REASONING)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [controlAction, setControlAction] = useState<'handoff' | 'release' | null>(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [chatOffset, setChatOffset] = useState(0)
  // Local state for real-time updates (pending_request, control_state)
  const [pendingRequest, setPendingRequest] = useState(session.pending_request)
  const [localControlState, setLocalControlState] = useState(session.control_state)
  const { approve, deny, handoff, release, executeTask, cancelTask, addChatMessage, loading } = useSessionActions()
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
    setLocalControlState(session.control_state)
  }, [session.pending_request, session.control_state])

  // Listen for sessions_update to get real-time pending_request updates
  useEffect(() => {
    const socket = getSocket()
    
    const handleSessionsUpdate = (sessions: Session[]) => {
      const updated = sessions.find(s => s.id === session.id)
      if (updated) {
        setPendingRequest(updated.pending_request)
        setLocalControlState(updated.control_state)
      }
    }
    
    socket.on('sessions_update', handleSessionsUpdate)
    return () => {
      socket.off('sessions_update', handleSessionsUpdate)
    }
  }, [session.id])

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
          fetch(`${API_BASE}/sessions/${session.id}/chat?limit=${CHAT_PAGE_SIZE}&offset=0`),
          fetch(`${API_BASE}/sessions/${session.id}/settings`)
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
          signal: controller.signal
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
      
      const chatRes = await fetch(`${API_BASE}/sessions/${session.id}/chat?limit=${CHAT_PAGE_SIZE}&offset=${chatOffset}`)
      if (chatRes.ok) {
        const data = await chatRes.json()
        if (data.messages?.length > 0) {
          // Prepend older messages
          setChatHistory(prev => [...data.messages.map(parseMessage), ...prev])
          setHasMoreMessages(data.has_more || false)
          setChatOffset(prev => prev + data.messages.length)
          
          // Restore scroll position after DOM updates
          setTimeout(() => {
            if (container) {
              const scrollHeightAfter = container.scrollHeight
              container.scrollTop = scrollHeightAfter - scrollHeightBefore
            }
            isLoadingOlderRef.current = false
          }, 0)
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
            const data = await chatRes.json()
            const msgs = data.messages || data
            setChatHistory(msgs.map((msg: any) => ({
              id: String(msg.id),
              type: msg.type as 'user' | 'assistant',
              content: msg.content,
              timestamp: new Date(msg.created_at),
              source: msg.source || 'web',
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
      // Check if this is for our session
      if (data.session_id === session.id) {
        setExecuting(true)
      }
    }
    
    const handleCliThinkingDone = (data: { session_id: string }) => {
      // Check if this is for our session
      if (data.session_id === session.id) {
        setExecuting(false)
        setCurrentTaskId(null)
      }
    }
    
    socket.on('task_started', handleTaskStarted)
    socket.on('task_completed', handleTaskCompleted)
    socket.on('task_cancelled', handleTaskCancelled)
    socket.on('chat_updated', handleChatUpdated)
    socket.on('cli_thinking', handleCliThinking)
    socket.on('cli_thinking_done', handleCliThinkingDone)
    
    return () => {
      socket.off('task_started', handleTaskStarted)
      socket.off('task_completed', handleTaskCompleted)
      socket.off('task_cancelled', handleTaskCancelled)
      socket.off('chat_updated', handleChatUpdated)
      socket.off('cli_thinking', handleCliThinking)
      socket.off('cli_thinking_done', handleCliThinkingDone)
    }
  }, [session.project_dir, session.id, currentTaskId])

  // Scroll to bottom when chat history changes (but not when loading older messages)
  useEffect(() => {
    if (!isLoadingOlderRef.current) {
      scrollToBottom()
    }
  }, [chatHistory, scrollToBottom])

  const controlState = localControlState || 'cli_active'
  const hasPendingRequest = pendingRequest !== null
  const isRemoteControlled = controlState === 'remote_active'
  const canHandoff = controlState === 'cli_active' || controlState === 'cli_waiting' || controlState === 'released'

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

      // Save assistant message to API and add to local state immediately
      try {
        const assistantResponse = await addChatMessage({
          sessionId: session.id,
          type: 'assistant',
          content: responseContent,
          status: result.success ? 'success' : 'error',
          durationMs: result.duration_ms,
          numTurns: result.num_turns,
        })
        // Add assistant message with DB-assigned ID immediately
        if (assistantResponse?.message) {
          const assistantMessage: ChatMessage = {
            id: String(assistantResponse.message.id),
            type: 'assistant',
            content: responseContent,
            timestamp: new Date(assistantResponse.message.created_at || Date.now()),
            status: result.success ? 'success' : 'error',
            meta: {
              duration: result.duration_ms,
              turns: result.num_turns,
            },
          }
          setChatHistory(prev => {
            if (prev.some(msg => msg.id === assistantMessage.id)) return prev
            return [...prev, assistantMessage]
          })
        }
      } catch (error) {
        // If API fails, add message to local state with temp ID
        const assistantMessage: ChatMessage = {
          id: `temp-${Date.now() + 1}`,
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
      }
    } catch (error) {
      const errorContent = String(error)
      
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
    } finally {
      setExecuting(false)
      setCurrentTaskId(null)
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

      <CardContent className="flex-1 flex flex-col space-y-3 overflow-hidden pt-0">
        {/* Pending Request */}
        {hasPendingRequest && pendingRequest && (
          <div className="rounded-md bg-muted p-3 shrink-0 max-h-[30vh] overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">{pendingRequest.message}</p>

            {pendingRequest.tool_name && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Terminal className="h-3 w-3" />
                <code>{pendingRequest.tool_name}</code>
              </div>
            )}

            {pendingRequest.type === 'permission' && (
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
                  executing={executing}
                  taskPrompt={taskPrompt}
                  setTaskPrompt={setTaskPrompt}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  reasoningEffort={reasoningEffort}
                  setReasoningEffort={setReasoningEffort}
                  onSubmit={handleTaskSubmit}
                  onCancel={handleCancelTask}
                  isRemoteControlled={isRemoteControlled}
                  canHandoff={canHandoff}
                  loading={loading}
                  onHandoff={handleHandoff}
                  onRelease={handleRelease}
                  actionError={actionError}
                  textareaRef={textareaRef}
                />
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
                  executing={executing}
                  taskPrompt={taskPrompt}
                  setTaskPrompt={setTaskPrompt}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  reasoningEffort={reasoningEffort}
                  setReasoningEffort={setReasoningEffort}
                  onSubmit={handleTaskSubmit}
                  onCancel={handleCancelTask}
                  isRemoteControlled={isRemoteControlled}
                  canHandoff={canHandoff}
                  loading={loading}
                  onHandoff={handleHandoff}
                  onRelease={handleRelease}
                  actionError={actionError}
                  textareaRef={textareaRef}
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




