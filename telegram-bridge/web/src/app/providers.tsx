'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, type ReactNode } from 'react'
import { connectSocket, disconnectSocket } from '@/lib/socket'

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
    connectSocket().catch(console.error)
    return () => disconnectSocket()
  }, [])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
