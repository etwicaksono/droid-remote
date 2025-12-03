'use client'

import { type FormEvent } from 'react'
import { Square, ArrowUp, Bot, Shield, Brain, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ReasoningEffort } from '@/types'
import modelsConfig from '@/config/models.json'

// Load models from JSON config file
const AVAILABLE_MODELS = modelsConfig.models as { id: string; name: string; reasoning: boolean }[]
const REASONING_LEVELS = modelsConfig.reasoningLevels as { id: ReasoningEffort; name: string }[]
const AUTONOMY_LEVELS = modelsConfig.autonomyLevels as { id: string; name: string; description: string }[]

export const DEFAULT_MODEL = modelsConfig.defaultModel
export const DEFAULT_REASONING = modelsConfig.defaultReasoningLevel as ReasoningEffort
export const DEFAULT_AUTONOMY = modelsConfig.defaultAutonomyLevel as string

const MAX_MESSAGE_INPUT_HEIGHT = 240

export interface InputBoxProps {
  // Core props
  executing: boolean
  taskPrompt: string
  setTaskPrompt: (value: string) => void
  selectedModel: string
  setSelectedModel: (value: string) => void
  reasoningEffort: ReasoningEffort
  setReasoningEffort: (value: ReasoningEffort) => void
  autonomyLevel: string
  setAutonomyLevel: (value: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  
  // UI options
  compact?: boolean
  disabled?: boolean
  placeholder?: string
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  
  // Queue mode - show "Add to Queue" instead of "Send"
  queueMode?: boolean
  onQueue?: () => void
  
  // Show cancel button (only for Web UI tasks, not CLI)
  showCancel?: boolean
}

export function InputBox({
  executing,
  taskPrompt,
  setTaskPrompt,
  selectedModel,
  setSelectedModel,
  reasoningEffort,
  setReasoningEffort,
  autonomyLevel,
  setAutonomyLevel,
  onSubmit,
  onCancel,
  compact = false,
  disabled = false,
  placeholder = "How can I help you today?",
  textareaRef,
  queueMode = false,
  onQueue,
  showCancel = false,
}: InputBoxProps) {
  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel)
  const supportsReasoning = currentModel?.reasoning ?? false

  return (
    <div className="space-y-2">
      {/* Input Container */}
      <form onSubmit={onSubmit} className="rounded-xl bg-muted/50 border border-border overflow-hidden">
        {/* Text Input */}
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
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
              if (taskPrompt.trim() && !executing && !disabled) {
                if (queueMode && onQueue) {
                  onQueue()
                } else {
                  onSubmit(e as unknown as FormEvent<HTMLFormElement>)
                }
              }
            }
          }}
          style={{ maxHeight: `${MAX_MESSAGE_INPUT_HEIGHT}px` }}
        />

        {/* Toolbar */}
        <div className={cn(
          "flex items-center justify-end px-3 pb-3 gap-1 sm:gap-2",
          disabled && "opacity-50"
        )}>
            {/* Model Selector */}
            <div className="flex items-center gap-1 hover:bg-muted rounded-lg transition-colors">
              <Bot className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={disabled || executing}
                className={cn(
                  "h-8 px-1 sm:px-2 text-xs bg-transparent border-0 cursor-pointer",
                  "focus:outline-none focus:ring-0 max-w-[100px] sm:max-w-none",
                  "[&>option]:bg-background [&>option]:text-foreground",
                  disabled && "cursor-not-allowed"
                )}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Thinking Mode - Only show if model supports it */}
            {supportsReasoning && (
              <div className="flex items-center gap-1 hover:bg-muted rounded-lg transition-colors">
                <Brain className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
                <select
                  value={reasoningEffort}
                  onChange={(e) => setReasoningEffort(e.target.value as ReasoningEffort)}
                  disabled={disabled || executing}
                  className={cn(
                    "h-8 px-1 sm:px-2 text-xs bg-transparent border-0 cursor-pointer",
                    "focus:outline-none focus:ring-0 max-w-[60px] sm:max-w-none",
                    "[&>option]:bg-background [&>option]:text-foreground",
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
              </div>
            )}

            {/* Autonomy Level Selector */}
            <div className="flex items-center gap-1 hover:bg-muted rounded-lg transition-colors">
              <Shield className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
              <select
                value={autonomyLevel}
                onChange={(e) => setAutonomyLevel(e.target.value)}
                disabled={disabled || executing}
                className={cn(
                  "h-8 px-1 sm:px-2 text-xs bg-transparent border-0 cursor-pointer",
                  "focus:outline-none focus:ring-0 max-w-[60px] sm:max-w-none",
                  "[&>option]:bg-background [&>option]:text-foreground",
                  disabled && "cursor-not-allowed"
                )}
                title="Autonomy level"
              >
                {AUTONOMY_LEVELS.map((level) => (
                  <option key={level.id} value={level.id} title={level.description}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Send/Cancel/Queue Button */}
            {showCancel ? (
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
            ) : queueMode ? (
              <Button
                type="button"
                onClick={onQueue}
                disabled={disabled || !taskPrompt.trim()}
                className="h-8 px-3 rounded-full shrink-0 bg-yellow-600 hover:bg-yellow-700 text-xs gap-1"
                title="Add to queue"
              >
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Queue</span>
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
      </form>

    </div>
  )
}
