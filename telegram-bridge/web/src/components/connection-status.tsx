'use client'

import { useSocket } from '@/hooks/use-socket'
import { cn } from '@/lib/utils'

export function ConnectionStatus() {
  const { connected } = useSocket()

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn('h-2 w-2 rounded-full', connected ? 'bg-green-500' : 'bg-red-500')}
      />
      <span className="text-muted-foreground">
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  )
}
