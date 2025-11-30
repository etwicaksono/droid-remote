'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PermissionCard } from './permission-card'
import type { PermissionRequest } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface PermissionHistoryProps {
  sessionId?: string
  limit?: number
}

export function PermissionHistory({ sessionId, limit = 20 }: PermissionHistoryProps) {
  const [permissions, setPermissions] = useState<PermissionRequest[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPermissions = async () => {
    setLoading(true)
    try {
      const endpoint = sessionId
        ? `${API_BASE}/sessions/${sessionId}/permissions?limit=${limit}`
        : `${API_BASE}/permissions?limit=${limit}`
      
      const res = await fetch(endpoint)
      if (res.ok) {
        const data = await res.json()
        setPermissions(data.permissions || [])
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPermissions()
  }, [sessionId, limit])

  const pendingCount = permissions.filter(
    (p) => p.decision === 'pending' || !p.decision
  ).length

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Permission Requests</CardTitle>
            {pendingCount > 0 && (
              <p className="text-sm text-yellow-500">{pendingCount} pending</p>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={fetchPermissions}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && permissions.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No permission requests found
          </div>
        ) : (
          <div className="space-y-3">
            {permissions.map((permission) => (
              <PermissionCard
                key={permission.id}
                permission={permission}
                onResolved={fetchPermissions}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
