'use client'

import { useState } from 'react'
import { X, Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAuthHeaders } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface CustomModel {
  id: string
  name: string
  base_url: string
  provider: string
  max_tokens: number
}

interface CustomModelModalProps {
  model: CustomModel | null
  onClose: () => void
  onSave: () => void
}

const PROVIDERS = [
  { id: 'generic-chat-completion-api', name: 'Generic Chat Completion API' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google' },
]

export function CustomModelModal({ model, onClose, onSave }: CustomModelModalProps) {
  const [formData, setFormData] = useState({
    model: model?.id || '',
    model_display_name: model?.name || '',
    base_url: model?.base_url || '',
    api_key: '',
    provider: model?.provider || 'generic-chat-completion-api',
    max_tokens: model?.max_tokens || 128000,
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!model

  const handleSubmit = async () => {
    if (!formData.model.trim() || !formData.base_url.trim()) {
      setError('Model ID and Base URL are required')
      return
    }

    if (!isEditing && !formData.api_key.trim()) {
      setError('API Key is required for new models')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const endpoint = isEditing
        ? `${API_BASE}/config/models/custom/${encodeURIComponent(model.id)}`
        : `${API_BASE}/config/models/custom`
      
      const payload = { ...formData }
      if (isEditing && !formData.api_key) {
        delete (payload as Record<string, unknown>).api_key
      }

      const res = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        onSave()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || 'Failed to save model')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card">
          <h3 className="font-semibold">{isEditing ? 'Edit Custom Model' : 'Add Custom Model'}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">
              Model ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder="gpt-5"
              disabled={isEditing}
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm font-mono disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Display Name
            </label>
            <input
              type="text"
              value={formData.model_display_name}
              onChange={(e) => setFormData({ ...formData, model_display_name: e.target.value })}
              placeholder="GPT-5 (Agentrouter)"
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Base URL <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              placeholder="https://api.example.com/v1"
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              API Key {!isEditing && <span className="text-red-400">*</span>}
            </label>
            <div className="relative mt-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder={isEditing ? '(unchanged)' : 'sk-...'}
                className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {isEditing && (
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to keep existing API key
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Provider</label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Max Tokens</label>
            <input
              type="number"
              value={formData.max_tokens}
              onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 0 })}
              placeholder="128000"
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
