'use client'

import { useState, useRef, useCallback, useEffect, type FormEvent } from 'react'
import { Folder, Loader2, ChevronDown, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSessionActions } from '@/hooks/use-session-actions'
import { InputBox, DEFAULT_MODEL, DEFAULT_REASONING, DEFAULT_AUTONOMY } from '@/components/chat/input-box'
import { DirectoryPickerModal } from '@/components/ui/directory-picker-modal'
import { cn } from '@/lib/utils'
import type { ReasoningEffort } from '@/types'
import modelsConfig from '@/config/models.json'
import { getAuthHeaders } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'
const AVAILABLE_MODELS = modelsConfig.models as { id: string; name: string; reasoning: boolean }[]

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function parseResultContent(resultStr: string | undefined, error: string | undefined): string {
  if (error) return error
  if (!resultStr) return 'Task completed'
  
  let content = resultStr
  
  if (content.startsWith('{') || content.startsWith('[')) {
    try {
      const parsed = JSON.parse(content)
      if (parsed.result !== undefined) {
        content = String(parsed.result)
      } else if (parsed.message) {
        content = parsed.message
      } else if (parsed.error) {
        content = parsed.error
      }
    } catch {
      // Not valid JSON
    }
  }
  
  content = content.replace(/^#\s*Answer\s*\n+/i, '').trim()
  return content || 'Task completed'
}

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  status?: 'success' | 'error'
  meta?: { duration?: number; turns?: number }
}

export function TaskForm() {
  const [projectDir, setProjectDir] = useState('')
  const [taskPrompt, setTaskPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(DEFAULT_REASONING)
  const [autonomyLevel, setAutonomyLevel] = useState(DEFAULT_AUTONOMY)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [executing, setExecuting] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  
  // Config state
  const [dockerMode, setDockerMode] = useState(false)
  const [projectDirs, setProjectDirs] = useState<string[]>([])
  const [showDirDropdown, setShowDirDropdown] = useState(false)
  const [isCustomInput, setIsCustomInput] = useState(false)
  
  const { executeTask, cancelTask } = useSessionActions()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const chatContainerRef = useRef<HTMLDivElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel)
  const supportsReasoning = currentModel?.reasoning ?? false
  
  // Fetch config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE}/config/project-dirs`, { headers: getAuthHeaders() })
        if (res.ok) {
          const data = await res.json()
          setDockerMode(data.docker_mode)
          setProjectDirs(data.project_dirs || [])
          // If no predefined dirs, start in custom input mode
          if (!data.project_dirs || data.project_dirs.length === 0) {
            setIsCustomInput(true)
          }
        }
      } catch (err) {
        console.error('Failed to fetch config:', err)
        setIsCustomInput(true)
      }
    }
    fetchConfig()
  }, [])
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDirDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [])

  const handleTaskSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!taskPrompt.trim() || !projectDir.trim() || executing) return

    const prompt = taskPrompt.trim()
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
    setCurrentTaskId(taskId)

    setTimeout(scrollToBottom, 100)

    try {
      const result = await executeTask({
        prompt,
        projectDir: projectDir.trim(),
        taskId,
        model: selectedModel,
        reasoningEffort: supportsReasoning ? reasoningEffort : undefined,
        autonomyLevel,
      })
      
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
      setCurrentTaskId(null)
      setTimeout(scrollToBottom, 100)
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
    } catch (error) {
      console.error('Failed to cancel task:', error)
    } finally {
      setExecuting(false)
      setCurrentTaskId(null)
    }
  }

  const isDisabled = !projectDir.trim()

  return (
    <div className="flex flex-col h-full">
      {/* Project Directory Header */}
      <div className="shrink-0 pb-4 border-b border-border">
        <label className="text-sm font-medium mb-2 block">Project Directory</label>
        <div className="flex gap-2">
          {/* Combobox: Select or Custom Input */}
          <div className="flex-1 relative" ref={dropdownRef}>
            {isCustomInput ? (
              <div className="flex gap-2">
                <Input
                  placeholder="/path/to/project"
                  value={projectDir}
                  onChange={(e) => setProjectDir(e.target.value)}
                  className="flex-1"
                />
                {projectDirs.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setIsCustomInput(false)
                      setShowDirDropdown(true)
                    }}
                    title="Select from saved projects"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDirDropdown(!showDirDropdown)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background text-sm",
                  "hover:bg-accent hover:text-accent-foreground transition-colors",
                  !projectDir && "text-muted-foreground"
                )}
              >
                <span className="truncate">{projectDir || "Select or type a path..."}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 ml-2 transition-transform", showDirDropdown && "rotate-180")} />
              </button>
            )}
            
            {/* Dropdown Menu */}
            {showDirDropdown && !isCustomInput && (
              <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
                <div className="max-h-60 overflow-y-auto py-1">
                  {/* Predefined directories */}
                  {projectDirs.map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => {
                        setProjectDir(dir)
                        setShowDirDropdown(false)
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
                        projectDir === dir && "bg-accent"
                      )}
                    >
                      <span className="truncate block">{dir}</span>
                    </button>
                  ))}
                  
                  {/* Divider */}
                  {projectDirs.length > 0 && (
                    <div className="border-t border-border my-1" />
                  )}
                  
                  {/* Custom input option */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomInput(true)
                      setShowDirDropdown(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 text-muted-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Type custom path...</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Browse button - only in native mode */}
          {!dockerMode && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPicker(true)}
              title="Browse directories"
            >
              <Folder className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 pt-4">
        {/* Empty State - Centered Welcome */}
        {chatHistory.length === 0 && !executing ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="text-center mb-6">
              <span className="text-3xl sm:text-4xl">🤖</span>
              <h2 className="text-xl sm:text-2xl font-light text-muted-foreground mt-2">
                How can I help you?
              </h2>
              {!projectDir && (
                <p className="text-sm text-muted-foreground mt-2">
                  Select a project directory to get started
                </p>
              )}
            </div>

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
                disabled={isDisabled}
                textareaRef={textareaRef}
                placeholder={isDisabled ? "Select a project directory first..." : "What would you like me to do?"}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Chat History */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-3">
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
                autonomyLevel={autonomyLevel}
                setAutonomyLevel={setAutonomyLevel}
                onSubmit={handleTaskSubmit}
                onCancel={handleCancelTask}
                disabled={isDisabled}
                textareaRef={textareaRef}
                compact
              />
            </div>
          </>
        )}
      </div>

      {/* Directory Picker Modal */}
      <DirectoryPickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={setProjectDir}
        initialPath={projectDir || undefined}
      />
    </div>
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
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
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
        <div className="text-sm whitespace-pre-wrap break-words">
          {isLong && !expanded
            ? message.content.substring(0, 300) + '...'
            : message.content}
        </div>

        {isLong && (
          <button
            className="text-xs mt-1 opacity-70 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}

        {!isUser && message.meta && (
          <div className="flex items-center gap-2 mt-1 text-xs opacity-60">
            {message.meta.duration && message.meta.duration > 0 && (
              <span>{(message.meta.duration / 1000).toFixed(1)}s</span>
            )}
            {message.meta.turns && message.meta.turns > 0 && (
              <span>{message.meta.turns} turns</span>
            )}
          </div>
        )}

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
