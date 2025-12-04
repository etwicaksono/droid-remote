'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Paperclip, X, Loader2, ImageIcon } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

export interface UploadedImage {
  url: string
  public_id: string
  name: string
  ref: string // @1, @2, etc.
}

interface DropzoneRenderProps {
  open: () => void
  isUploading: boolean
}

interface ImageUploadAreaProps {
  onUpload: (file: File) => Promise<void>
  disabled?: boolean
  children: React.ReactNode | ((props: DropzoneRenderProps) => React.ReactNode)
}

export function ImageUploadArea({ onUpload, disabled, children }: ImageUploadAreaProps) {
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (disabled || isUploading) return
    
    for (const file of acceptedFiles) {
      setIsUploading(true)
      try {
        await onUpload(file)
      } catch (error) {
        console.error('Upload failed:', error)
      } finally {
        setIsUploading(false)
      }
    }
  }, [onUpload, disabled, isUploading])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'] },
    maxSize: 10 * 1024 * 1024,
    disabled: disabled || isUploading,
    noClick: true,
    noKeyboard: true,
  })

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />
      
      {/* Drop overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 border-2 border-dashed border-primary rounded-xl">
          <div className="flex flex-col items-center gap-2 text-primary">
            <ImageIcon className="h-8 w-8" />
            <span className="text-sm font-medium">Drop image here</span>
          </div>
        </div>
      )}
      
      {/* Pass open function to children via render prop */}
      {typeof children === 'function' 
        ? children({ open, isUploading })
        : children
      }
    </div>
  )
}

interface ImageUploadButtonProps {
  onClick: () => void
  disabled?: boolean
  isUploading?: boolean
}

export function ImageUploadButton({ onClick, disabled, isUploading }: ImageUploadButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled || isUploading}
      title="Attach image (or paste/drop)"
      className="h-8 w-8"
    >
      {isUploading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Paperclip className="h-4 w-4" />
      )}
    </Button>
  )
}

interface ImagePreviewProps {
  images: UploadedImage[]
  onRemove: (index: number) => void
  onInsertRef: (ref: string) => void
}

export function ImagePreview({ images, onRemove, onInsertRef }: ImagePreviewProps) {
  if (images.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 p-2 border-b border-border">
      {images.map((image, index) => (
        <div key={image.public_id} className="relative group">
          <div 
            className="relative h-16 w-16 rounded border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
            onClick={() => onInsertRef(image.ref)}
            title={`Click to insert ${image.ref}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={image.name}
              className="h-full w-full object-cover"
            />
            {/* Reference badge */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs text-center py-0.5 font-mono">
              {image.ref}
            </div>
          </div>
          
          {/* Remove button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(index)
            }}
            className="absolute -top-1.5 -right-1.5 p-0.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

interface VisionWarningProps {
  show: boolean
}

export function VisionWarning({ show }: VisionWarningProps) {
  if (!show) return null
  
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-yellow-500 bg-yellow-500/10 rounded">
      <span>⚠️</span>
      <span>Selected model doesn&apos;t support images</span>
    </div>
  )
}
