import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// Parse date string as UTC (backend sends UTC without Z suffix)
function parseDate(date: Date | string): Date {
  if (date instanceof Date) return date
  // Append Z if missing to ensure UTC parsing
  const utcStr = date.endsWith('Z') ? date : date + 'Z'
  return new Date(utcStr)
}

export function formatDate(date: Date | string): string {
  const d = parseDate(date)
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
}

export function formatRelativeTime(date: Date | string): string {
  const d = parseDate(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return formatDate(d)
}
