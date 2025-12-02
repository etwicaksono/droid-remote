'use client'

import { type FormEvent } from 'react'
import { Play, Square, Loader2, Plus, Settings, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ReasoningEffort } from '@/types'
import modelsConfig from '@/config/models.json'

// Load models from JSON config file
const AVAILABLE_MODELS = modelsConfig.models as { id: string; name: string; reasoning: boolean }[]
const REASONING_LEVELS = modelsConfig.reasoningLevels as { id: ReasoningEffort; name: string }[]

export const DEFAULT_MODEL = modelsConfig.defaultModel
export const DEFAULT_REASONING = modelsConfig.defaultReasoningLevel as ReasoningEffort

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
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  
  // Optional session control props
  isRemoteControlled?: boolean
  canHandoff?: boolean
  loading?: boolean
  onHandoff?: () => void
  onRelease?: () => void
  actionError?: string | null
  
  // UI options
  compact?: boolean
  disabled?: boolean
  placeholder?: string
  showControlButtons?: boolean
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

export function InputBox({
  executing,
  taskPrompt,
  setTaskPrompt,
  selectedModel,
  setSelectedModel,
  reasoningEffort,
  setReasoningEffort,
  onSubmit,
  onCancel,
  isRemoteControlled = true,
  canHandoff = false,
  loading = false,
  onHandoff,
  onRelease,
  actionError,
  compact = false,
  disabled: disabledProp,
  placeholder,
  showControlButtons = true,
  textareaRef,
}: InputBoxProps) {
  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel)
  const supportsReasoning = currentModel?.reasoning ?? false
  const disabled = disabledProp ?? !isRemoteControlled

  const defaultPlaceholder = isRemoteControlled 
    ? "How can I help you today?" 
    : "Take control to send messages..."

  return (
    <div className="space-y-2">
      {/* Input Container */}
      <form onSubmit={onSubmit} className="rounded-xl bg-muted/50 border border-border overflow-hidden">
        {/* Text Input */}
        <Textarea
          ref={textareaRef}
          placeholder={placeholder ?? defaultPlaceholder}
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

      {/* Control Button - only show if showControlButtons and handlers provided */}
      {showControlButtons && (onHandoff || onRelease) && (
        <div className="flex gap-2">
          {isRemoteControlled ? (
            onRelease && (
              <Button onClick={onRelease} disabled={loading} variant="outline" className="flex-1">
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">{loading ? 'Releasing...' : 'Release to CLI'}</span>
                <span className="sm:hidden">{loading ? '...' : 'Release'}</span>
              </Button>
            )
          ) : canHandoff ? (
            onHandoff && (
              <Button onClick={onHandoff} disabled={loading} className="flex-1">
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">{loading ? 'Taking control...' : 'Take Control'}</span>
                <span className="sm:hidden">{loading ? '...' : 'Control'}</span>
              </Button>
            )
          ) : (
            <div className="flex-1 h-10 flex items-center justify-center text-sm text-muted-foreground bg-muted rounded-md">
              CLI is active
            </div>
          )}
        </div>
      )}
    </div>
  )
}
