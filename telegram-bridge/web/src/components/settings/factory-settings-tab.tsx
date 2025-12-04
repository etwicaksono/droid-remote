'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Save, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HooksSection } from './hooks-section'
import { getAuthHeaders } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

const MODELS = [
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-20250514',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.5-preview',
  'o3',
  'o4-mini',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
]

const REASONING_OPTIONS = ['off', 'low', 'medium', 'high'] as const
const AUTONOMY_OPTIONS = ['auto-low', 'auto-medium', 'auto-high'] as const
const FOCUS_OPTIONS = ['always', 'focused', 'never'] as const

interface FactorySettings {
  model?: string
  reasoningEffort?: string
  autonomyMode?: string
  cloudSessionSync?: boolean
  diffMode?: string
  enableCompletionBell?: boolean
  completionSound?: string
  awaitingInputSound?: string
  soundFocusMode?: string
  enableCustomDroids?: boolean
  includeCoAuthoredByDroid?: boolean
  enableDroidShield?: boolean
  enableReadinessReport?: boolean
  allowBackgroundProcesses?: boolean
  showThinkingInMainView?: boolean
  todoDisplayMode?: string
  commandAllowlist?: string[]
  commandDenylist?: string[]
  hooks?: Record<string, unknown[]>
}

export function FactorySettingsTab() {
  const [settings, setSettings] = useState<FactorySettings>({})
  const [settingsPath, setSettingsPath] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [originalSettings, setOriginalSettings] = useState<FactorySettings>({})
  
  // Command list states
  const [newAllowCmd, setNewAllowCmd] = useState('')
  const [newDenyCmd, setNewDenyCmd] = useState('')
  const [denylistExpanded, setDenylistExpanded] = useState(false)

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/factory-settings`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings || {})
        setOriginalSettings(data.settings || {})
        setSettingsPath(data.path || '')
        setHasChanges(false)
      } else {
        const errData = await res.json().catch(() => ({ detail: 'Unknown error' }))
        setError(errData.detail || 'Failed to load settings')
      }
    } catch (err) {
      setError('Failed to connect to server')
      console.error('Failed to fetch factory settings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const updateSetting = <K extends keyof FactorySettings>(key: K, value: FactorySettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/factory-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setOriginalSettings(settings)
        setHasChanges(false)
      } else {
        const errData = await res.json().catch(() => ({ detail: 'Unknown error' }))
        setError(errData.detail || 'Failed to save settings')
      }
    } catch (err) {
      setError('Failed to save settings')
      console.error('Failed to save factory settings:', err)
    } finally {
      setSaving(false)
    }
  }

  const addToList = (key: 'commandAllowlist' | 'commandDenylist', value: string) => {
    if (!value.trim()) return
    const current = settings[key] || []
    if (!current.includes(value.trim())) {
      updateSetting(key, [...current, value.trim()])
    }
    if (key === 'commandAllowlist') setNewAllowCmd('')
    else setNewDenyCmd('')
  }

  const removeFromList = (key: 'commandAllowlist' | 'commandDenylist', index: number) => {
    const current = settings[key] || []
    updateSetting(key, current.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading settings...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !settings.model) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchSettings} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with path and save button */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground truncate">
          {settingsPath}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={fetchSettings}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={saveSettings} disabled={saving || !hasChanges}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Model & Reasoning */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Model & Reasoning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Model</label>
            <select
              value={settings.model || ''}
              onChange={(e) => updateSetting('model', e.target.value)}
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              {MODELS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
              {settings.model && !MODELS.includes(settings.model) && (
                <option value={settings.model}>{settings.model}</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Reasoning Effort</label>
            <div className="flex gap-2 mt-1">
              {REASONING_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="reasoning"
                    checked={settings.reasoningEffort === opt}
                    onChange={() => updateSetting('reasoningEffort', opt)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Autonomy Mode</label>
            <div className="flex gap-2 mt-1">
              {AUTONOMY_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="autonomy"
                    checked={settings.autonomyMode === opt}
                    onChange={() => updateSetting('autonomyMode', opt)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{opt.replace('auto-', '')}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'cloudSessionSync', label: 'Cloud Session Sync' },
            { key: 'enableCustomDroids', label: 'Custom Droids' },
            { key: 'includeCoAuthoredByDroid', label: 'Include Co-authored by Droid' },
            { key: 'enableDroidShield', label: 'Droid Shield' },
            { key: 'enableReadinessReport', label: 'Readiness Report' },
            { key: 'allowBackgroundProcesses', label: 'Allow Background Processes' },
            { key: 'showThinkingInMainView', label: 'Show Thinking in Main View' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings[key as keyof FactorySettings]}
                onChange={(e) => updateSetting(key as keyof FactorySettings, e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Sounds */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sounds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!settings.enableCompletionBell}
              onChange={(e) => updateSetting('enableCompletionBell', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Enable Completion Bell</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Completion Sound</label>
              <input
                type="text"
                value={settings.completionSound || ''}
                onChange={(e) => updateSetting('completionSound', e.target.value)}
                className="w-full mt-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Awaiting Input Sound</label>
              <input
                type="text"
                value={settings.awaitingInputSound || ''}
                onChange={(e) => updateSetting('awaitingInputSound', e.target.value)}
                className="w-full mt-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Focus Mode</label>
            <div className="flex gap-3 mt-1">
              {FOCUS_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="focusMode"
                    checked={settings.soundFocusMode === opt}
                    onChange={() => updateSetting('soundFocusMode', opt)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Command Allowlist */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Command Allowlist</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {(settings.commandAllowlist?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground mb-3">No commands in allowlist</p>
          ) : (
            <div className="space-y-1 mb-3">
              {settings.commandAllowlist?.map((cmd, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <code className="text-sm">{cmd}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFromList('commandAllowlist', i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newAllowCmd}
              onChange={(e) => setNewAllowCmd(e.target.value)}
              placeholder="Add command..."
              className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
              onKeyDown={(e) => e.key === 'Enter' && addToList('commandAllowlist', newAllowCmd)}
            />
            <Button size="sm" onClick={() => addToList('commandAllowlist', newAllowCmd)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Command Denylist */}
      <Card>
        <CardHeader className="pb-2">
          <button
            onClick={() => setDenylistExpanded(!denylistExpanded)}
            className="flex items-center justify-between w-full"
          >
            <CardTitle className="text-base">Command Denylist</CardTitle>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs">{settings.commandDenylist?.length || 0} commands</span>
              {denylistExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </button>
        </CardHeader>
        {denylistExpanded && (
          <CardContent>
            {(settings.commandDenylist?.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground mb-3">No commands in denylist</p>
            ) : (
              <div className="space-y-1 mb-3 max-h-60 overflow-y-auto">
                {settings.commandDenylist?.map((cmd, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <code className="text-sm break-all">{cmd}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeFromList('commandDenylist', i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newDenyCmd}
                onChange={(e) => setNewDenyCmd(e.target.value)}
                placeholder="Add command..."
                className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
                onKeyDown={(e) => e.key === 'Enter' && addToList('commandDenylist', newDenyCmd)}
              />
              <Button size="sm" onClick={() => addToList('commandDenylist', newDenyCmd)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Hooks */}
      <Card>
        <CardContent className="pt-6">
          <HooksSection
            hooks={settings.hooks as Record<string, { hooks: { type: string; command: string; timeout: number }[] }[]> || {}}
            onChange={(hooks) => updateSetting('hooks', hooks)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
