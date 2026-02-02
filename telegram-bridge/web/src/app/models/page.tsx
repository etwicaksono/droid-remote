'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageLayout } from '@/components/layout/page-layout'
import { getAuthHeaders } from '@/lib/api'
import { DefaultModelModal } from '@/components/settings/default-model-modal'
import { CustomModelModal } from '@/components/settings/custom-model-modal'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface DefaultModel {
  id: string
  name: string
  reasoning: boolean
  vision: boolean
  reasoningLevels?: string[]
  defaultReasoning?: string
}

interface CustomModel {
  id: string
  name: string
  reasoning: boolean
  vision: boolean
  source: string
  base_url: string
  provider: string
  max_tokens: number
}

interface ModelsConfig {
  models: (DefaultModel | CustomModel)[]
  defaultModels: DefaultModel[]
  customModels: CustomModel[]
  defaultModel: string
  reasoningLevels: { id: string; name: string }[]
  autonomyLevels: { id: string; name: string; description: string }[]
  factoryConfigPath: string | null
}

export default function ModelsPage() {
  const [config, setConfig] = useState<ModelsConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDefaultModel, setSelectedDefaultModel] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Modal state
  const [showDefaultModal, setShowDefaultModal] = useState(false)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [editingDefault, setEditingDefault] = useState<DefaultModel | null>(null)
  const [editingCustom, setEditingCustom] = useState<CustomModel | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'default' | 'custom'; id: string } | null>(null)

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/config/models`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
        setSelectedDefaultModel(data.defaultModel || '')
      } else {
        setError('Failed to load models configuration')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleSaveDefaultSelection = async () => {
    if (!selectedDefaultModel) return
    
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/config/models/default-selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ modelId: selectedDefaultModel }),
      })
      if (!res.ok) {
        setError('Failed to save default model')
      }
    } catch (err) {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteModel = async (type: 'default' | 'custom', id: string) => {
    try {
      const endpoint = type === 'default' 
        ? `${API_BASE}/config/models/default/${encodeURIComponent(id)}`
        : `${API_BASE}/config/models/custom/${encodeURIComponent(id)}`
      
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      
      if (res.ok) {
        fetchConfig()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || 'Failed to delete model')
      }
    } catch (err) {
      setError('Failed to delete model')
    } finally {
      setDeleteConfirm(null)
    }
  }

  const handleEditDefault = (model: DefaultModel) => {
    setEditingDefault(model)
    setShowDefaultModal(true)
  }

  const handleEditCustom = (model: CustomModel) => {
    setEditingCustom(model)
    setShowCustomModal(true)
  }

  if (loading) {
    return (
      <PageLayout title="Models" currentPath="/models">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Models" currentPath="/models">
      <div className="p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">×</button>
          </div>
        )}

        {/* Default Models Section */}
        <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Default Models</h2>
                <p className="text-sm text-muted-foreground">Factory.ai provided models</p>
              </div>
              <Button onClick={() => { setEditingDefault(null); setShowDefaultModal(true); }} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Model ID</th>
                    <th className="text-left p-3 font-medium">Display Name</th>
                    <th className="text-center p-3 font-medium">Reasoning</th>
                    <th className="text-center p-3 font-medium">Vision</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {config?.defaultModels.map((model) => (
                    <tr key={model.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{model.id}</td>
                      <td className="p-3">{model.name}</td>
                      <td className="p-3 text-center">
                        {model.reasoning ? (
                          <span className="text-green-500">✓</span>
                        ) : (
                          <span className="text-gray-500">✗</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {model.vision ? (
                          <span className="text-green-500">✓</span>
                        ) : (
                          <span className="text-gray-500">✗</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditDefault(model)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm({ type: 'default', id: model.id })}
                            className="h-8 w-8 text-red-500 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!config?.defaultModels || config.defaultModels.length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        No default models configured
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Default Model Selection */}
            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm font-medium">Default Model:</label>
              <select
                value={selectedDefaultModel}
                onChange={(e) => setSelectedDefaultModel(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                {config?.defaultModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
              <Button
                onClick={handleSaveDefaultSelection}
                disabled={saving || selectedDefaultModel === config?.defaultModel}
                size="sm"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </section>

          {/* Custom Models Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Custom Models</h2>
                <p className="text-sm text-muted-foreground">
                  {config?.factoryConfigPath 
                    ? `Source: ${config.factoryConfigPath}`
                    : 'FACTORY_CUSTOM_MODEL_CONFIG_PATH not configured'}
                </p>
              </div>
              <Button 
                onClick={() => { setEditingCustom(null); setShowCustomModal(true); }} 
                size="sm"
                disabled={!config?.factoryConfigPath}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {!config?.factoryConfigPath ? (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-sm text-yellow-400">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Set FACTORY_CUSTOM_MODEL_CONFIG_PATH environment variable to manage custom models.
              </div>
            ) : (
              <div className="bg-card border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Model ID</th>
                      <th className="text-left p-3 font-medium">Display Name</th>
                      <th className="text-left p-3 font-medium">Provider</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config?.customModels.map((model) => (
                      <tr key={model.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{model.id}</td>
                        <td className="p-3">{model.name}</td>
                        <td className="p-3 text-xs text-muted-foreground">{model.provider}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditCustom(model)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirm({ type: 'custom', id: model.id })}
                              className="h-8 w-8 text-red-500 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!config?.customModels || config.customModels.length === 0) && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground">
                          No custom models configured
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-2 text-xs text-muted-foreground">
              ⚠️ Changes to custom models will update Factory CLI config.json
            </p>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">Delete Model</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete this model? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteModel(deleteConfirm.type, deleteConfirm.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Default Model Modal */}
      {showDefaultModal && (
        <DefaultModelModal
          model={editingDefault}
          onClose={() => { setShowDefaultModal(false); setEditingDefault(null); }}
          onSave={() => { setShowDefaultModal(false); setEditingDefault(null); fetchConfig(); }}
        />
      )}

      {/* Custom Model Modal */}
      {showCustomModal && (
        <CustomModelModal
          model={editingCustom}
          onClose={() => { setShowCustomModal(false); setEditingCustom(null); }}
          onSave={() => { setShowCustomModal(false); setEditingCustom(null); fetchConfig(); }}
        />
      )}
    </PageLayout>
  )
}
