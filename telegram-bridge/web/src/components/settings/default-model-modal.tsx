'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAuthHeaders } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface DefaultModel {
  id: string
  name: string
  reasoning: boolean
  vision: boolean
  reasoningLevels?: string[]
  defaultReasoning?: string
}

interface DefaultModelModalProps {
  model: DefaultModel | null
  onClose: () => void
  onSave: () => void
}

export function DefaultModelModal({ model, onClose, onSave }: DefaultModelModalProps) {
  const [formData, setFormData] = useState({
    id: model?.id || '',
    name: model?.name || '',
    reasoning: model?.reasoning ?? true,
    vision: model?.vision ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!model

  const handleSubmit = async () => {
    if (!formData.id.trim() || !formData.name.trim()) {
      setError('Model ID and Display Name are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const endpoint = isEditing
        ? `${API_BASE}/config/models/default/${encodeURIComponent(model.id)}`
        : `${API_BASE}/config/models/default`
      
      const res = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(formData),
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
      <div className="bg-card border rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{isEditing ? 'Edit Model' : 'Add Model'}</h3>
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
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              placeholder="claude-sonnet-4-5-20250929"
              disabled={isEditing}
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm font-mono disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Must match Factory CLI model identifier
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">
              Display Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Claude Sonnet 4.5"
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Capabilities</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.reasoning}
                  onChange={(e) => setFormData({ ...formData, reasoning: e.target.checked })}
                  className="rounded border-input"
                />
                Supports Reasoning
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.vision}
                  onChange={(e) => setFormData({ ...formData, vision: e.target.checked })}
                  className="rounded border-input"
                />
                Supports Vision
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
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
