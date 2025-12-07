'use client'

import { useState, useEffect } from 'react'
import { Loader2, Eye, EyeOff, AlertTriangle, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageLayout } from '@/components/layout/page-layout'
import { getAuthHeaders } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface EnvConfig {
  variables: Record<string, string>
  defaults: Record<string, string>
  managed_vars: string[]
  sensitive_vars: string[]
  dirty: boolean
}

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR']

const VAR_LABELS: Record<string, string> = {
  WEB_UI_URL: 'Web UI URL',
  AUTH_USERNAME: 'Username',
  AUTH_PASSWORD: 'Password',
  JWT_EXPIRY_HOURS: 'JWT Expiry (hours)',
  DEFAULT_TIMEOUT: 'Default Timeout (sec)',
  PERMISSION_TIMEOUT: 'Permission Timeout (sec)',
  NOTIFY_TIMEOUT: 'Notify Timeout (sec)',
  TELEGRAM_TASK_RESULT_MAX_LENGTH: 'Telegram Result Max Length',
  LOG_LEVEL: 'Log Level',
  ENABLE_DIRECTORY_BROWSER: 'Enable Directory Browser',
  MAX_UPLOAD_SIZE_MB: 'Max Upload Size (MB)',
}

const VAR_DESCRIPTIONS: Record<string, string> = {
  WEB_UI_URL: 'URL for links in Telegram messages',
  AUTH_USERNAME: 'Login username for web UI',
  AUTH_PASSWORD: 'Login password for web UI',
  JWT_EXPIRY_HOURS: 'How long login sessions last',
  DEFAULT_TIMEOUT: 'Default timeout for operations',
  PERMISSION_TIMEOUT: 'Timeout for permission requests',
  NOTIFY_TIMEOUT: 'Timeout for notifications',
  TELEGRAM_TASK_RESULT_MAX_LENGTH: '0 = unlimited, otherwise max characters',
  LOG_LEVEL: 'Server logging verbosity',
  ENABLE_DIRECTORY_BROWSER: 'Allow browsing directories from web UI',
  MAX_UPLOAD_SIZE_MB: 'Maximum file upload size',
}

export default function EnvironmentSettingsPage() {
  const [config, setConfig] = useState<EnvConfig | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/config/env`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data: EnvConfig = await res.json()
        setConfig(data)
        setFormData(data.variables)
        setIsDirty(data.dirty)
      } else {
        setError('Failed to load environment settings')
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

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`${API_BASE}/config/env`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setSuccess('Settings saved. Restart server to apply changes.')
        setIsDirty(true)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || 'Failed to save settings')
      }
    } catch (err) {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleDismiss = async () => {
    try {
      await fetch(`${API_BASE}/config/env/dismiss`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      setIsDirty(false)
    } catch (err) {
      console.error('Failed to dismiss:', err)
    }
  }

  if (loading) {
    return (
      <PageLayout title="Environment Settings" currentPath="/settings/environment">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  const isSensitive = (key: string) => config?.sensitive_vars.includes(key)

  return (
    <PageLayout title="Environment Settings" currentPath="/settings/environment">
      <div className="p-4 space-y-6">
        {/* Restart Banner */}
        {isDirty && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-yellow-500">Environment changed</p>
              <p className="text-sm text-yellow-500/80 mt-1">
                Restart the server to apply changes. Run: <code className="bg-yellow-500/20 px-1 rounded">docker-compose restart</code> or restart <code className="bg-yellow-500/20 px-1 rounded">python server.py</code>
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-yellow-500 hover:text-yellow-400">
              Dismiss
            </Button>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
            {success}
          </div>
        )}

        {/* Server Section */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Server</h2>
          <div className="bg-card border rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{VAR_LABELS.WEB_UI_URL}</label>
              <input
                type="text"
                value={formData.WEB_UI_URL || ''}
                onChange={(e) => handleChange('WEB_UI_URL', e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                placeholder={config?.defaults.WEB_UI_URL}
              />
              <p className="text-xs text-muted-foreground mt-1">{VAR_DESCRIPTIONS.WEB_UI_URL}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{VAR_LABELS.LOG_LEVEL}</label>
              <select
                value={formData.LOG_LEVEL || 'INFO'}
                onChange={(e) => handleChange('LOG_LEVEL', e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {LOG_LEVELS.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">{VAR_DESCRIPTIONS.LOG_LEVEL}</p>
            </div>
          </div>
        </section>

        {/* Authentication Section */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Authentication</h2>
          <div className="bg-card border rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{VAR_LABELS.AUTH_USERNAME}</label>
              <input
                type="text"
                value={formData.AUTH_USERNAME || ''}
                onChange={(e) => handleChange('AUTH_USERNAME', e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                placeholder={config?.defaults.AUTH_USERNAME}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground mt-1">{VAR_DESCRIPTIONS.AUTH_USERNAME}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{VAR_LABELS.AUTH_PASSWORD}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.AUTH_PASSWORD || ''}
                  onChange={(e) => handleChange('AUTH_PASSWORD', e.target.value)}
                  className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{VAR_DESCRIPTIONS.AUTH_PASSWORD}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{VAR_LABELS.JWT_EXPIRY_HOURS}</label>
              <input
                type="number"
                value={formData.JWT_EXPIRY_HOURS || ''}
                onChange={(e) => handleChange('JWT_EXPIRY_HOURS', e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                placeholder={config?.defaults.JWT_EXPIRY_HOURS}
                min="1"
              />
              <p className="text-xs text-muted-foreground mt-1">{VAR_DESCRIPTIONS.JWT_EXPIRY_HOURS}</p>
            </div>
          </div>
        </section>

        {/* Timeouts Section */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Timeouts</h2>
          <div className="bg-card border rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{VAR_LABELS.DEFAULT_TIMEOUT}</label>
                <input
                  type="number"
                  value={formData.DEFAULT_TIMEOUT || ''}
                  onChange={(e) => handleChange('DEFAULT_TIMEOUT', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  placeholder={config?.defaults.DEFAULT_TIMEOUT}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{VAR_LABELS.PERMISSION_TIMEOUT}</label>
                <input
                  type="number"
                  value={formData.PERMISSION_TIMEOUT || ''}
                  onChange={(e) => handleChange('PERMISSION_TIMEOUT', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  placeholder={config?.defaults.PERMISSION_TIMEOUT}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{VAR_LABELS.NOTIFY_TIMEOUT}</label>
                <input
                  type="number"
                  value={formData.NOTIFY_TIMEOUT || ''}
                  onChange={(e) => handleChange('NOTIFY_TIMEOUT', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  placeholder={config?.defaults.NOTIFY_TIMEOUT}
                  min="1"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">All timeouts are in seconds</p>
          </div>
        </section>

        {/* Features Section */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Features</h2>
          <div className="bg-card border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium">{VAR_LABELS.ENABLE_DIRECTORY_BROWSER}</label>
                <p className="text-xs text-muted-foreground">{VAR_DESCRIPTIONS.ENABLE_DIRECTORY_BROWSER}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.ENABLE_DIRECTORY_BROWSER === 'true'}
                  onChange={(e) => handleChange('ENABLE_DIRECTORY_BROWSER', e.target.checked ? 'true' : 'false')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{VAR_LABELS.MAX_UPLOAD_SIZE_MB}</label>
                <input
                  type="number"
                  value={formData.MAX_UPLOAD_SIZE_MB || ''}
                  onChange={(e) => handleChange('MAX_UPLOAD_SIZE_MB', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  placeholder={config?.defaults.MAX_UPLOAD_SIZE_MB}
                  min="1"
                />
                <p className="text-xs text-muted-foreground mt-1">{VAR_DESCRIPTIONS.MAX_UPLOAD_SIZE_MB}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{VAR_LABELS.TELEGRAM_TASK_RESULT_MAX_LENGTH}</label>
                <input
                  type="number"
                  value={formData.TELEGRAM_TASK_RESULT_MAX_LENGTH || ''}
                  onChange={(e) => handleChange('TELEGRAM_TASK_RESULT_MAX_LENGTH', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  placeholder={config?.defaults.TELEGRAM_TASK_RESULT_MAX_LENGTH}
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">{VAR_DESCRIPTIONS.TELEGRAM_TASK_RESULT_MAX_LENGTH}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Changes are saved to .env file. Restart the server to apply.
        </p>
      </div>
    </PageLayout>
  )
}
