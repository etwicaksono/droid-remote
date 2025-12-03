'use client'

import { useState, useEffect } from 'react'
import { getSocket, connectSocket, isSocketConnected } from '@/lib/socket'

export function useSocket() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = getSocket()

    const handleConnect = () => setConnected(true)
    const handleDisconnect = () => setConnected(false)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    // Initial connection
    if (!isSocketConnected()) {
      connectSocket().catch(console.error)
    } else {
      setConnected(true)
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [])

  return { connected }
}
