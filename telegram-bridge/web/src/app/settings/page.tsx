'use client'

import { useState, useEffect } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageLayout } from '@/components/layout/page-layout'

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

export default function SettingsPage() {
  const [rules, setRules] = useState<AllowlistRule[]>([])
  const [loading, setLoading] = useState(true)
  const [newTool, setNewTool] = useState('Edit')
  const [newPattern, setNewPattern] = useState('*')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/allowlist`)
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
      })
      if (res.ok) {
        await fetchRules()
        setNewPattern('*')
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
      })
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== ruleId))
      }
    } catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'Z')
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <PageLayout title="Settings" currentPath="/settings">
      <div className="max-w-3xl mx-auto space-y-6 p-4">
        {/* Section Header */}
        <div>
          <h2 className="text-lg font-semibold">Permission Allowlist</h2>
          <p className="text-sm text-muted-foreground">
            Tools that will be auto-approved without prompting
          </p>
        </div>

        {/* Add Rule Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Rule</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Rules List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current Rules</CardTitle>
            <CardDescription>
              {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : rules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No rules configured. Add a rule above to auto-approve tools.
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">Tool</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Pattern</th>
                      <th className="px-4 py-2 text-left text-sm font-medium hidden sm:table-cell">Added</th>
                      <th className="px-4 py-2 text-right text-sm font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm">
                          <code className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                            {rule.tool_name}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <code className="px-1.5 py-0.5 bg-muted rounded">
                            {rule.pattern}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                          {formatDate(rule.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pattern Examples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <code className="px-1.5 py-0.5 bg-muted rounded shrink-0">*</code>
              <span>Allow all operations for this tool</span>
            </div>
            <div className="flex items-start gap-2">
              <code className="px-1.5 py-0.5 bg-muted rounded shrink-0">npm *</code>
              <span>Allow commands starting with &quot;npm&quot;</span>
            </div>
            <div className="flex items-start gap-2">
              <code className="px-1.5 py-0.5 bg-muted rounded shrink-0">git status</code>
              <span>Allow exact command &quot;git status&quot;</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
