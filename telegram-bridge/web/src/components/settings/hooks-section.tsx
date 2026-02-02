'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, X, Check, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse', 
  'UserPromptSubmit',
  'Notification',
  'Stop',
  'SubagentStop',
  'SessionStart',
  'SessionEnd',
] as const

type HookEvent = typeof HOOK_EVENTS[number]

interface Hook {
  type: string
  command: string
  timeout: number
}

interface HookGroup {
  hooks: Hook[]
}

interface HooksData {
  [event: string]: HookGroup[]
}

interface HooksSectionProps {
  hooks: HooksData
  disabledHooks: HooksData
  onChange: (hooks: HooksData, disabledHooks: HooksData) => void
}

export function HooksSection({ hooks, disabledHooks, onChange }: HooksSectionProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingHook, setEditingHook] = useState<{ event: string; index: number; disabled: boolean } | null>(null)
  const [editForm, setEditForm] = useState({ command: '', timeout: 60 })

  const toggleEvent = (event: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      if (next.has(event)) {
        next.delete(event)
      } else {
        next.add(event)
      }
      return next
    })
  }

  const getHookCount = (event: string, source: HooksData): number => {
    const groups = source[event] || []
    return groups.reduce((sum, g) => sum + (g.hooks?.length || 0), 0)
  }

  const getTotalCount = (event: string): { enabled: number; disabled: number } => {
    return {
      enabled: getHookCount(event, hooks),
      disabled: getHookCount(event, disabledHooks)
    }
  }

  const deleteHookEvent = (event: string) => {
    const newHooks = { ...hooks }
    const newDisabled = { ...disabledHooks }
    delete newHooks[event]
    delete newDisabled[event]
    onChange(newHooks, newDisabled)
  }

  const deleteHook = (event: string, groupIndex: number, hookIndex: number, isDisabled: boolean) => {
    const source = isDisabled ? disabledHooks : hooks
    const newSource = { ...source }
    const groups = [...(newSource[event] || [])]
    
    if (groups[groupIndex]?.hooks) {
      groups[groupIndex] = {
        ...groups[groupIndex],
        hooks: groups[groupIndex].hooks.filter((_, i) => i !== hookIndex)
      }
      const filteredGroups = groups.filter(g => g.hooks?.length > 0)
      if (filteredGroups.length === 0) {
        delete newSource[event]
      } else {
        newSource[event] = filteredGroups
      }
      
      if (isDisabled) {
        onChange(hooks, newSource)
      } else {
        onChange(newSource, disabledHooks)
      }
    }
  }

  const toggleHookEnabled = (event: string, groupIndex: number, hookIndex: number, currentlyDisabled: boolean) => {
    const source = currentlyDisabled ? disabledHooks : hooks
    const target = currentlyDisabled ? hooks : disabledHooks
    
    const hook = source[event]?.[groupIndex]?.hooks?.[hookIndex]
    if (!hook) return

    // Remove from source
    const newSource = { ...source }
    const sourceGroups = [...(newSource[event] || [])]
    if (sourceGroups[groupIndex]?.hooks) {
      sourceGroups[groupIndex] = {
        ...sourceGroups[groupIndex],
        hooks: sourceGroups[groupIndex].hooks.filter((_, i) => i !== hookIndex)
      }
      const filteredGroups = sourceGroups.filter(g => g.hooks?.length > 0)
      if (filteredGroups.length === 0) {
        delete newSource[event]
      } else {
        newSource[event] = filteredGroups
      }
    }

    // Add to target
    const newTarget = { ...target }
    if (!newTarget[event]) {
      newTarget[event] = [{ hooks: [] }]
    }
    const targetGroups = newTarget[event]
    if (targetGroups && targetGroups[0]) {
      targetGroups[0].hooks.push(hook)
    }

    if (currentlyDisabled) {
      onChange(newTarget, newSource)
    } else {
      onChange(newSource, newTarget)
    }
  }

  const startEdit = (event: string, groupIndex: number, hookIndex: number, isDisabled: boolean) => {
    const source = isDisabled ? disabledHooks : hooks
    const hook = source[event]?.[groupIndex]?.hooks?.[hookIndex]
    if (hook) {
      setEditingHook({ event, index: hookIndex, disabled: isDisabled })
      setEditForm({ command: hook.command, timeout: hook.timeout })
    }
  }

  const saveEdit = (event: string, groupIndex: number, hookIndex: number, isDisabled: boolean) => {
    const source = isDisabled ? disabledHooks : hooks
    const newSource = { ...source }
    const groups = [...(newSource[event] || [])]
    
    if (groups[groupIndex]?.hooks?.[hookIndex]) {
      groups[groupIndex] = {
        ...groups[groupIndex],
        hooks: groups[groupIndex].hooks.map((h, i) => 
          i === hookIndex ? { ...h, command: editForm.command, timeout: editForm.timeout } : h
        )
      }
      newSource[event] = groups
      
      if (isDisabled) {
        onChange(hooks, newSource)
      } else {
        onChange(newSource, disabledHooks)
      }
    }
    setEditingHook(null)
  }

  const cancelEdit = () => {
    setEditingHook(null)
  }

  // Get all events (from both enabled and disabled)
  const allEvents = new Set([
    ...Object.keys(hooks).filter(e => HOOK_EVENTS.includes(e as HookEvent)),
    ...Object.keys(disabledHooks).filter(e => HOOK_EVENTS.includes(e as HookEvent))
  ])
  const activeEvents = Array.from(allEvents)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Hooks</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {activeEvents.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
          No hooks configured
        </div>
      ) : (
        <div className="space-y-2">
          {activeEvents.map(event => {
            const isExpanded = expandedEvents.has(event)
            const counts = getTotalCount(event)
            const totalCount = counts.enabled + counts.disabled
            const enabledGroups = hooks[event] || []
            const disabledGroups = disabledHooks[event] || []

            return (
              <div key={event} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 hover:bg-muted/50">
                  <button
                    onClick={() => toggleEvent(event)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <code className="font-medium text-sm">{event}</code>
                    <span className="text-xs text-muted-foreground">
                      ({counts.enabled} active{counts.disabled > 0 && `, ${counts.disabled} disabled`})
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteHookEvent(event)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {isExpanded && (
                  <div className="border-t bg-muted/20 p-3 space-y-3">
                    {/* Enabled hooks */}
                    {enabledGroups.map((group, groupIndex) => (
                      group.hooks?.map((hook, hookIndex) => (
                        <HookItem
                          key={`enabled-${groupIndex}-${hookIndex}`}
                          hook={hook}
                          event={event}
                          groupIndex={groupIndex}
                          hookIndex={hookIndex}
                          isDisabled={false}
                          isEditing={editingHook?.event === event && editingHook?.index === hookIndex && !editingHook?.disabled}
                          editForm={editForm}
                          setEditForm={setEditForm}
                          onToggle={() => toggleHookEnabled(event, groupIndex, hookIndex, false)}
                          onEdit={() => startEdit(event, groupIndex, hookIndex, false)}
                          onSave={() => saveEdit(event, groupIndex, hookIndex, false)}
                          onCancel={cancelEdit}
                          onDelete={() => deleteHook(event, groupIndex, hookIndex, false)}
                        />
                      ))
                    ))}
                    {/* Disabled hooks */}
                    {disabledGroups.map((group, groupIndex) => (
                      group.hooks?.map((hook, hookIndex) => (
                        <HookItem
                          key={`disabled-${groupIndex}-${hookIndex}`}
                          hook={hook}
                          event={event}
                          groupIndex={groupIndex}
                          hookIndex={hookIndex}
                          isDisabled={true}
                          isEditing={editingHook?.event === event && editingHook?.index === hookIndex && editingHook?.disabled}
                          editForm={editForm}
                          setEditForm={setEditForm}
                          onToggle={() => toggleHookEnabled(event, groupIndex, hookIndex, true)}
                          onEdit={() => startEdit(event, groupIndex, hookIndex, true)}
                          onSave={() => saveEdit(event, groupIndex, hookIndex, true)}
                          onCancel={cancelEdit}
                          onDelete={() => deleteHook(event, groupIndex, hookIndex, true)}
                        />
                      ))
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAddModal && (
        <AddHookModal
          onAdd={(event, hook) => {
            const newHooks = { ...hooks }
            if (!newHooks[event]) {
              newHooks[event] = [{ hooks: [] }]
            }
            const eventHooks = newHooks[event]
            if (eventHooks && eventHooks[0]) {
              eventHooks[0].hooks.push(hook)
            }
            onChange(newHooks, disabledHooks)
            setShowAddModal(false)
            setExpandedEvents(prev => new Set(prev).add(event))
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}

interface HookItemProps {
  hook: Hook
  event: string
  groupIndex: number
  hookIndex: number
  isDisabled: boolean
  isEditing: boolean
  editForm: { command: string; timeout: number }
  setEditForm: (fn: (prev: { command: string; timeout: number }) => { command: string; timeout: number }) => void
  onToggle: () => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}

function HookItem({
  hook,
  isDisabled,
  isEditing,
  editForm,
  setEditForm,
  onToggle,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: HookItemProps) {
  return (
    <div className={cn(
      "border rounded-lg p-3 bg-background transition-opacity",
      isDisabled && "opacity-50"
    )}>
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Command</label>
            <input
              type="text"
              value={editForm.command}
              onChange={(e) => setEditForm(f => ({ ...f, command: e.target.value }))}
              className="w-full mt-1 h-9 px-3 rounded-md border border-input bg-background text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Timeout (seconds)</label>
            <input
              type="number"
              value={editForm.timeout}
              onChange={(e) => setEditForm(f => ({ ...f, timeout: parseInt(e.target.value) || 60 }))}
              className="w-24 mt-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave}>
              <Check className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            {/* Toggle button */}
            <button
              onClick={onToggle}
              className={cn(
                "mt-0.5 p-1.5 rounded-md transition-colors",
                isDisabled 
                  ? "bg-muted text-muted-foreground hover:bg-muted/80" 
                  : "bg-green-500/20 text-green-500 hover:bg-green-500/30"
              )}
              title={isDisabled ? "Enable hook" : "Disable hook"}
            >
              <Power className="h-3.5 w-3.5" />
            </button>
            
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Type:</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{hook.type}</code>
                {isDisabled && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">disabled</span>
                )}
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Command:</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{hook.command}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Timeout:</span>
                <span className="text-xs">{hook.timeout}s</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface AddHookModalProps {
  onAdd: (event: string, hook: Hook) => void
  onClose: () => void
}

function AddHookModal({ onAdd, onClose }: AddHookModalProps) {
  const [event, setEvent] = useState<string>(HOOK_EVENTS[0])
  const [command, setCommand] = useState('')
  const [timeout, setTimeout] = useState(60)

  const handleAdd = () => {
    if (!command.trim()) return
    onAdd(event, { type: 'command', command: command.trim(), timeout })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-background border rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Add Hook</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Hook Event</label>
            <select
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              {HOOK_EVENTS.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Command</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="python /path/to/script.py"
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Timeout (seconds)</label>
            <input
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(parseInt(e.target.value) || 60)}
              className="w-24 mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!command.trim()}>Add Hook</Button>
        </div>
      </div>
    </div>
  )
}
