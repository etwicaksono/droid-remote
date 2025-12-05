'use client'

import { useState } from 'react'
import { X, FolderOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAuthHeaders } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface AddSessionModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface DirectoryItem {
  name: string
  path: string
}

export function AddSessionModal({ onClose, onSuccess }: AddSessionModalProps) {
  const [sessionId, setSessionId] = useState('')
  const [projectDir, setProjectDir] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Directory browser state
  const [showBrowser, setShowBrowser] = useState(false)
  const [browserPath, setBrowserPath] = useState('')
  const [browserParent, setBrowserParent] = useState<string | null>(null)
  const [browserDirs, setBrowserDirs] = useState<DirectoryItem[]>([])
  const [browserDrives, setBrowserDrives] = useState<string[]>([])
  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserError, setBrowserError] = useState<string | null>(null)

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

  const openBrowser = async (path?: string) => {
    setShowBrowser(true)
    setBrowserLoading(true)
    setBrowserError(null)

    try {
      const params = path ? `?path=${encodeURIComponent(path)}` : ''
      const response = await fetch(`${API_BASE}/filesystem/browse${params}`, {
        headers: getAuthHeaders(),
      })

      if (response.ok) {
        const data = await response.json()
        setBrowserPath(data.current_path || '')
        setBrowserParent(data.parent || null)
        setBrowserDirs(data.directories || [])
        setBrowserDrives(data.drives || [])
      } else {
        setBrowserError('Failed to browse directory')
      }
    } catch (err) {
      setBrowserError('Failed to connect to server')
    } finally {
      setBrowserLoading(false)
    }
  }

  const navigateToDir = (path: string) => {
    openBrowser(path)
  }

  const selectDirectory = () => {
    setProjectDir(browserPath)
    setShowBrowser(false)
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
              <input
                type="text"
                value={projectDir}
                onChange={(e) => setProjectDir(e.target.value)}
                placeholder="D:\Project\my-app"
                className="flex-1 h-10 px-3 rounded-md border border-gray-600 bg-gray-800 text-white text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => openBrowser(projectDir || undefined)}
                className="h-10 w-10 shrink-0"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
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

      {/* Directory Browser Modal */}
      {showBrowser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="font-semibold text-white">Select Directory</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowBrowser(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2 mb-3 p-2 bg-gray-800 rounded text-sm font-mono text-gray-300 overflow-x-auto">
                <FolderOpen className="h-4 w-4 shrink-0 text-blue-400" />
                <span className="truncate">{browserPath || '/'}</span>
              </div>

              {browserError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 mb-3">
                  {browserError}
                </div>
              )}

              {browserLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-gray-700 rounded-lg">
                  {/* Windows drives */}
                  {browserDrives.length > 0 && !browserParent && (
                    <div className="p-2 border-b border-gray-700 bg-gray-800/50">
                      <div className="text-xs text-gray-500 mb-1">Drives</div>
                      <div className="flex flex-wrap gap-1">
                        {browserDrives.map((drive) => (
                          <button
                            key={drive}
                            onClick={() => navigateToDir(drive)}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-200"
                          >
                            {drive}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Parent directory */}
                  {browserParent && (
                    <button
                      onClick={() => navigateToDir(browserParent)}
                      className="w-full flex items-center gap-2 p-3 hover:bg-gray-800 text-left text-sm border-b border-gray-700"
                    >
                      <FolderOpen className="h-4 w-4 text-yellow-400 shrink-0" />
                      <span className="text-gray-200">..</span>
                    </button>
                  )}
                  {/* Subdirectories */}
                  {browserDirs.length === 0 && !browserParent ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No directories found
                    </div>
                  ) : (
                    browserDirs.map((dir) => (
                      <button
                        key={dir.path}
                        onClick={() => navigateToDir(dir.path)}
                        className="w-full flex items-center gap-2 p-3 hover:bg-gray-800 text-left text-sm border-b border-gray-700 last:border-b-0"
                      >
                        <FolderOpen className="h-4 w-4 text-blue-400 shrink-0" />
                        <span className="text-gray-200 truncate">{dir.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
              <Button variant="outline" onClick={() => setShowBrowser(false)}>
                Cancel
              </Button>
              <Button onClick={selectDirectory} disabled={!browserPath}>
                Select
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
