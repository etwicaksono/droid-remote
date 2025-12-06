'use client'

import { useState, useEffect } from 'react'
import { getAuthHeaders } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

export interface Model {
  id: string
  name: string
  reasoning: boolean
  vision: boolean
  source?: 'default' | 'custom'
  reasoningLevels?: string[]
  defaultReasoning?: string
}

export interface ReasoningLevel {
  id: string
  name: string
}

export interface AutonomyLevel {
  id: string
  name: string
  description: string
}

export interface ModelsConfig {
  models: Model[]
  defaultModel: string
  reasoningLevels: ReasoningLevel[]
  defaultReasoningLevel: string
  autonomyLevels: AutonomyLevel[]
  defaultAutonomyLevel: string
}

// Cache the models config
let cachedConfig: ModelsConfig | null = null
let fetchPromise: Promise<ModelsConfig> | null = null

async function fetchModelsConfig(): Promise<ModelsConfig> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig
  }

  // Return existing fetch promise if one is in progress
  if (fetchPromise) {
    return fetchPromise
  }

  // Start new fetch
  fetchPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/config/models`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        cachedConfig = {
          models: data.models || [],
          defaultModel: data.defaultModel || '',
          reasoningLevels: data.reasoningLevels || [],
          defaultReasoningLevel: data.defaultReasoningLevel || 'off',
          autonomyLevels: data.autonomyLevels || [],
          defaultAutonomyLevel: data.defaultAutonomyLevel || 'high',
        }
        return cachedConfig
      }
    } catch (err) {
      console.error('Failed to fetch models config:', err)
    }
    
    // Return fallback config
    return {
      models: [],
      defaultModel: '',
      reasoningLevels: [
        { id: 'off', name: 'Off' },
        { id: 'low', name: 'Low' },
        { id: 'medium', name: 'Medium' },
        { id: 'high', name: 'High' },
      ],
      defaultReasoningLevel: 'off',
      autonomyLevels: [
        { id: 'off', name: 'Spec', description: 'Research and plan only' },
        { id: 'low', name: 'Low', description: 'Edits and read-only commands' },
        { id: 'medium', name: 'Medium', description: 'Allow reversible commands' },
        { id: 'high', name: 'High', description: 'Allow all commands' },
      ],
      defaultAutonomyLevel: 'high',
    }
  })()

  return fetchPromise
}

// Clear cache (call when models are updated)
export function clearModelsCache() {
  cachedConfig = null
  fetchPromise = null
}

export function useModels() {
  const [config, setConfig] = useState<ModelsConfig | null>(cachedConfig)
  const [loading, setLoading] = useState(!cachedConfig)

  useEffect(() => {
    if (cachedConfig) {
      setConfig(cachedConfig)
      setLoading(false)
      return
    }

    fetchModelsConfig().then((data) => {
      setConfig(data)
      setLoading(false)
    })
  }, [])

  return {
    models: config?.models || [],
    defaultModel: config?.defaultModel || '',
    reasoningLevels: config?.reasoningLevels || [],
    defaultReasoningLevel: config?.defaultReasoningLevel || 'off',
    autonomyLevels: config?.autonomyLevels || [],
    defaultAutonomyLevel: config?.defaultAutonomyLevel || 'high',
    loading,
    refresh: () => {
      clearModelsCache()
      setLoading(true)
      fetchModelsConfig().then((data) => {
        setConfig(data)
        setLoading(false)
      })
    },
  }
}
