'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  onChange: (hooks: HooksData) => void
}

export function HooksSection({ hooks, onChange }: HooksSectionProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingHook, setEditingHook] = useState<{ event: string; index: number } | null>(null)
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

  const getHookCount = (event: string): number => {
    const groups = hooks[event] || []
    return groups.reduce((sum, g) => sum + (g.hooks?.length || 0), 0)
  }

  const deleteHookEvent = (event: string) => {
    const newHooks = { ...hooks }
    delete newHooks[event]
    onChange(newHooks)
  }

  const deleteHook = (event: string, groupIndex: number, hookIndex: number) => {
    const newHooks = { ...hooks }
    const groups = [...(newHooks[event] || [])]
    if (groups[groupIndex]?.hooks) {
      groups[groupIndex] = {
        ...groups[groupIndex],
        hooks: groups[groupIndex].hooks.filter((_, i) => i !== hookIndex)
      }
      // Remove empty groups
      const filteredGroups = groups.filter(g => g.hooks?.length > 0)
      if (filteredGroups.length === 0) {
        delete newHooks[event]
      } else {
        newHooks[event] = filteredGroups
      }
      onChange(newHooks)
    }
  }

  const startEdit = (event: string, groupIndex: number, hookIndex: number) => {
    const hook = hooks[event]?.[groupIndex]?.hooks?.[hookIndex]
    if (hook) {
      setEditingHook({ event, index: hookIndex })
      setEditForm({ command: hook.command, timeout: hook.timeout })
    }
  }

  const saveEdit = (event: string, groupIndex: number, hookIndex: number) => {
    const newHooks = { ...hooks }
    const groups = [...(newHooks[event] || [])]
    if (groups[groupIndex]?.hooks?.[hookIndex]) {
      groups[groupIndex] = {
        ...groups[groupIndex],
        hooks: groups[groupIndex].hooks.map((h, i) => 
          i === hookIndex ? { ...h, command: editForm.command, timeout: editForm.timeout } : h
        )
      }
      newHooks[event] = groups
      onChange(newHooks)
    }
    setEditingHook(null)
  }

  const cancelEdit = () => {
    setEditingHook(null)
  }

  const activeEvents = Object.keys(hooks).filter(e => HOOK_EVENTS.includes(e as HookEvent))

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
            const count = getHookCount(event)
            const groups = hooks[event] || []

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
                      ({count} hook{count !== 1 ? 's' : ''})
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
                    {groups.map((group, groupIndex) => (
                      group.hooks?.map((hook, hookIndex) => {
                        const isEditing = editingHook?.event === event && editingHook?.index === hookIndex

                        return (
                          <div key={`${groupIndex}-${hookIndex}`} className="border rounded-lg p-3 bg-background">
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
                                  <Button size="sm" onClick={() => saveEdit(event, groupIndex, hookIndex)}>
                                    <Check className="h-4 w-4 mr-1" />
                                    Save
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelEdit}>
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Type:</span>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{hook.type}</code>
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
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => startEdit(event, groupIndex, hookIndex)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => deleteHook(event, groupIndex, hookIndex)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })
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
          existingEvents={activeEvents}
          onAdd={(event, hook) => {
            const newHooks = { ...hooks }
            if (!newHooks[event]) {
              newHooks[event] = [{ hooks: [] }]
            }
            const eventHooks = newHooks[event]
            if (eventHooks && eventHooks[0]) {
              eventHooks[0].hooks.push(hook)
            }
            onChange(newHooks)
            setShowAddModal(false)
            setExpandedEvents(prev => new Set(prev).add(event))
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}

interface AddHookModalProps {
  existingEvents: string[]
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
