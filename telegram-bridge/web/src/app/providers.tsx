'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, type ReactNode } from 'react'
import { connectSocket } from '@/lib/socket'
import { AuthProvider } from '@/contexts/auth-context'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  )

  useEffect(() => {
    // Connect socket once on app load - don't disconnect on unmount
    // as we want to keep the connection alive for the lifetime of the app
    connectSocket().catch(console.error)
    // No cleanup - socket should stay connected
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}
