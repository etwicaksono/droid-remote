'use client'

import { useState, useEffect } from 'react'
import { Trash2, Plus, RefreshCw, ChevronDown, ChevronRight, Terminal, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/utils'
import { getAuthHeaders } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

const TOOLS = [
  'Edit',
  'Read', 
  'Create',
  'Execute',
  'Grep',
  'Glob',
  'LS',
  'MultiEdit',
  'WebSearch',
  'FetchUrl',
]

interface AllowlistRule {
  id: number
  tool_name: string
  pattern: string
  description?: string
  created_at: string
}

interface GroupedRules {
  [toolName: string]: AllowlistRule[]
}

export function PermissionsTab() {
  const [rules, setRules] = useState<AllowlistRule[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const [newTool, setNewTool] = useState('Edit')
  const [newPattern, setNewPattern] = useState('*')
  const [adding, setAdding] = useState(false)

  const fetchRules = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/allowlist`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules || [])
      }
    } catch (err) {
      console.error('Failed to fetch allowlist:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRules()
  }, [])

  const groupedRules: GroupedRules = rules.reduce((acc, rule) => {
    const toolName = rule.tool_name || 'Unknown'
    if (!acc[toolName]) {
      acc[toolName] = []
    }
    acc[toolName].push(rule)
    return acc
  }, {} as GroupedRules)

  const sortedToolNames = Object.keys(groupedRules).sort((a, b) => {
    const aLatest = groupedRules[a]?.[0]?.created_at || ''
    const bLatest = groupedRules[b]?.[0]?.created_at || ''
    return new Date(bLatest).getTime() - new Date(aLatest).getTime()
  })

  const toggleTool = (toolName: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(toolName)) {
        next.delete(toolName)
      } else {
        next.add(toolName)
      }
      return next
    })
  }

  const addRule = async () => {
    if (!newTool || !newPattern.trim()) return
    
    setAdding(true)
    try {
      const params = new URLSearchParams({
        tool_name: newTool,
        pattern: newPattern.trim(),
      })
      const res = await fetch(`${API_BASE}/allowlist?${params}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        await fetchRules()
        setNewPattern('*')
        setExpandedTools(prev => new Set(prev).add(newTool))
      }
    } catch (err) {
      console.error('Failed to add rule:', err)
    } finally {
      setAdding(false)
    }
  }

  const deleteRule = async (ruleId: number) => {
    try {
      const res = await fetch(`${API_BASE}/allowlist/${ruleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== ruleId))
      }
    } catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg">Permission Allowlist</CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchRules}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && rules.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No rules configured. Add a rule below to auto-approve tools.
          </div>
        ) : (
          <div className="space-y-2">
            {sortedToolNames.map((toolName) => {
              const toolRules = groupedRules[toolName]
              if (!toolRules) return null
              const isExpanded = expandedTools.has(toolName)
              const latestRule = toolRules[0]

              return (
                <div key={toolName} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleTool(toolName)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Terminal className="h-4 w-4 text-muted-foreground" />
                      <code className="font-medium bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-sm">
                        {toolName}
                      </code>
                      <span className="text-xs text-muted-foreground">
                        ({toolRules.length} rule{toolRules.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{latestRule?.created_at ? formatRelativeTime(latestRule.created_at) : ''}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t bg-muted/20">
                      {toolRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="p-3 border-b last:border-b-0 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Pattern:</span>
                              <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                                {rule.pattern}
                              </code>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3" />
                              <span>Added {formatRelativeTime(rule.created_at)}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteRule(rule.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-medium mb-3">Add New Rule</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={newTool}
              onChange={(e) => setNewTool(e.target.value)}
              className="h-10 px-3 rounded-md border border-input bg-background text-sm [&>option]:bg-background [&>option]:text-foreground"
            >
              {TOOLS.map(tool => (
                <option key={tool} value={tool}>{tool}</option>
              ))}
            </select>
            <input
              type="text"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="Pattern (e.g., * or npm *)"
              className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addRule()
              }}
            />
            <Button onClick={addRule} disabled={adding || !newPattern.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <code className="bg-muted px-1 rounded">*</code> = all, 
            <code className="bg-muted px-1 rounded ml-1">npm *</code> = prefix match, 
            <code className="bg-muted px-1 rounded ml-1">git status</code> = exact match
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
