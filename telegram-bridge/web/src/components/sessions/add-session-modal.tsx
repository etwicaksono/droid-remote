'use client'

import { useState, useEffect } from 'react'
import { X, Folder, Loader2 } from 'lucide-react'
import CreatableSelect from 'react-select/creatable'
import { Button } from '@/components/ui/button'
import { DirectoryPickerModal } from '@/components/ui/directory-picker-modal'
import { getAuthHeaders } from '@/lib/api'
import { cn } from '@/lib/utils'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface AddSessionModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface DirOption {
  value: string
  label: string
}

export function AddSessionModal({ onClose, onSuccess }: AddSessionModalProps) {
  const [sessionId, setSessionId] = useState('')
  const [projectDir, setProjectDir] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Config state
  const [browserEnabled, setBrowserEnabled] = useState(true)
  const [dirOptions, setDirOptions] = useState<DirOption[]>([])
  const [showPicker, setShowPicker] = useState(false)

  // Fetch config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE}/config/project-dirs`, { headers: getAuthHeaders() })
        if (res.ok) {
          const data = await res.json()
          setBrowserEnabled(data.browser_enabled !== false)
          const dirs = data.project_dirs || []
          setDirOptions(dirs.map((d: string) => ({ value: d, label: d })))
        }
      } catch (err) {
        console.error('Failed to fetch config:', err)
      }
    }
    fetchConfig()
  }, [])

  const handleSubmit = async () => {
    if (!sessionId.trim() || !projectDir.trim()) {
      setError('Session ID and Project Directory are required')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/hooks/sessions/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          session_id: sessionId.trim(),
          project_dir: projectDir.trim(),
          session_name: sessionName.trim() || undefined,
        }),
      })

      if (response.ok) {
        onSuccess()
        onClose()
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.detail || 'Failed to register session')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="font-semibold text-white">Add Session Manually</h3>
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
            <label className="text-sm font-medium text-gray-200">
              Session ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="cc2a971c-ac4d-4e0d-85ee-0cc4eadb5912"
              className="w-full mt-1 h-10 px-3 rounded-md border border-gray-600 bg-gray-800 text-white text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Copy from Factory CLI or ~/.factory/sessions folder
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-200">
              Project Directory <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2 mt-1">
              <div className="flex-1">
                <CreatableSelect<DirOption>
                  isClearable
                  options={dirOptions}
                  value={projectDir ? { value: projectDir, label: projectDir } : null}
                  onChange={(option) => setProjectDir(option?.value || '')}
                  onCreateOption={(inputValue) => setProjectDir(inputValue)}
                  placeholder="Select or type a path..."
                  formatCreateLabel={(inputValue) => `Use "${inputValue}"`}
                  classNames={{
                    control: () => '!bg-gray-800 !border-gray-600 !shadow-none !min-h-[40px]',
                    menu: () => '!bg-gray-800 !border-gray-600',
                    option: ({ isFocused, isSelected }) => 
                      cn('!cursor-pointer', isFocused && '!bg-gray-700', isSelected && '!bg-gray-700'),
                    singleValue: () => '!text-white',
                    input: () => '!text-white',
                    placeholder: () => '!text-gray-500',
                    indicatorSeparator: () => '!bg-gray-600',
                    dropdownIndicator: () => '!text-gray-500',
                    clearIndicator: () => '!text-gray-500',
                  }}
                  styles={{
                    control: (base) => ({ ...base, backgroundColor: 'rgb(31 41 55)' }),
                    menu: (base) => ({ ...base, backgroundColor: 'rgb(31 41 55)' }),
                    option: (base) => ({ ...base, backgroundColor: 'transparent' }),
                    singleValue: (base) => ({ ...base, color: 'white' }),
                    input: (base) => ({ ...base, color: 'white' }),
                  }}
                />
              </div>
              
              {browserEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPicker(true)}
                  title="Browse directories"
                >
                  <Folder className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-200">
              Session Name <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Uses folder name if empty"
              className="w-full mt-1 h-10 px-3 rounded-md border border-gray-600 bg-gray-800 text-white text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !sessionId.trim() || !projectDir.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Session'
            )}
          </Button>
        </div>
      </div>

      {/* Directory Picker Modal */}
      <DirectoryPickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={setProjectDir}
        initialPath={projectDir || undefined}
      />
    </div>
  )
}
