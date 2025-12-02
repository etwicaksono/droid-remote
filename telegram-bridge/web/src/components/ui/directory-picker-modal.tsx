'use client'

import { useState, useEffect, useCallback } from 'react'
import { Folder, ChevronRight, HardDrive, Loader2, X, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface Directory {
  name: string
  path: string
}

interface BrowseResponse {
  current_path: string
  parent: string | null
  directories: Directory[]
  drives: string[]
}

interface DirectoryPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (path: string) => void
  initialPath?: string
}

export function DirectoryPickerModal({
  isOpen,
  onClose,
  onSelect,
  initialPath,
}: DirectoryPickerModalProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [parent, setParent] = useState<string | null>(null)
  const [directories, setDirectories] = useState<Directory[]>([])
  const [drives, setDrives] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const browse = useCallback(async (path?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = path 
        ? `${API_BASE}/filesystem/browse?path=${encodeURIComponent(path)}`
        : `${API_BASE}/filesystem/browse`
      const res = await fetch(url)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to browse directory')
      }
      const data: BrowseResponse = await res.json()
      setCurrentPath(data.current_path)
      setParent(data.parent)
      setDirectories(data.directories)
      setDrives(data.drives)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse directory')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      browse(initialPath || undefined)
    }
  }, [isOpen, initialPath, browse])

  const handleNavigate = (path: string) => {
    browse(path)
  }

  const handleSelect = () => {
    onSelect(currentPath)
    onClose()
  }

  const handleGoUp = () => {
    if (parent) {
      browse(parent)
    }
  }

  // Parse path into segments for breadcrumb
  const pathSegments = currentPath.split(/[/\\]/).filter(Boolean)
  
  // Build clickable breadcrumb paths
  const buildPath = (index: number): string => {
    const isWindows = currentPath.includes('\\') || drives.length > 0
    const segments = pathSegments.slice(0, index + 1)
    if (isWindows) {
      // Add back the drive letter format
      if (segments[0] && !segments[0].includes(':')) {
        segments[0] = segments[0] + ':'
      }
      return segments.join('\\')
    }
    return '/' + segments.join('/')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Select Project Directory</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="px-4 py-2 border-b border-gray-800 bg-gray-800/50">
          <div className="flex items-center gap-1 text-sm overflow-x-auto">
            {/* Drive selector for Windows */}
            {drives.length > 0 && (
              <select
                value={pathSegments[0] ? pathSegments[0].replace(':', '') + ':' : ''}
                onChange={(e) => handleNavigate(e.target.value + '\\')}
                className="bg-transparent border-0 text-sm cursor-pointer hover:bg-gray-700 rounded px-1 py-0.5"
              >
                {drives.map((drive) => (
                  <option key={drive} value={drive.replace('\\', '')}>
                    {drive.replace('\\', '')}
                  </option>
                ))}
              </select>
            )}
            
            {/* Path segments */}
            {pathSegments.map((segment, index) => {
              // Skip drive letter on Windows (handled by dropdown)
              if (index === 0 && drives.length > 0 && segment.includes(':')) {
                return null
              }
              return (
                <span key={index} className="flex items-center">
                  <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                  <button
                    onClick={() => handleNavigate(buildPath(index))}
                    className="hover:bg-gray-700 rounded px-1 py-0.5 truncate max-w-[150px]"
                    title={segment}
                  >
                    {segment}
                  </button>
                </span>
              )
            })}
          </div>
        </div>

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32 text-red-400 text-sm">
              {error}
            </div>
          ) : (
            <>
              {/* Go up button */}
              {parent && (
                <button
                  onClick={handleGoUp}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-800 transition-colors text-left"
                >
                  <ArrowUp className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-400">..</span>
                </button>
              )}
              
              {/* Directories */}
              {directories.length === 0 && !parent ? (
                <div className="text-center text-gray-500 py-8 text-sm">
                  No subdirectories
                </div>
              ) : (
                directories.map((dir) => (
                  <button
                    key={dir.path}
                    onClick={() => handleNavigate(dir.path)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-800 transition-colors text-left"
                  >
                    <Folder className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="truncate">{dir.name}</span>
                  </button>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 space-y-3">
          <div className="text-xs text-gray-400 truncate" title={currentPath}>
            Selected: <span className="text-gray-200">{currentPath}</span>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSelect} disabled={!currentPath}>
              Select
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
