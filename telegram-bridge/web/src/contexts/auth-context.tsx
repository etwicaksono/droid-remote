'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { reconnectSocket } from '@/lib/socket'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

interface AuthContextType {
  token: string | null
  username: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string, username: string) => void
  logout: () => void
  getAuthHeader: () => Record<string, string>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Public routes that don't require auth
const PUBLIC_ROUTES = ['/login']

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [token, setToken] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('auth_token')
      const storedUsername = localStorage.getItem('auth_username')

      if (!storedToken) {
        setIsLoading(false)
        return
      }

      // Verify token with server
      try {
        const res = await fetch(`${API_BASE}/auth/verify`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        })

        if (res.ok) {
          setToken(storedToken)
          setUsername(storedUsername)
        } else {
          // Token invalid, clear it
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_username')
        }
      } catch (err) {
        console.error('Auth verification failed:', err)
        // Keep token on network error (offline mode)
        setToken(storedToken)
        setUsername(storedUsername)
      }

      setIsLoading(false)
    }

    checkAuth()
  }, [])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isLoading) return

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

    if (!token && !isPublicRoute) {
      router.push('/login')
    } else if (token && pathname === '/login') {
      router.push('/')
    }
  }, [token, isLoading, pathname, router])

  const login = useCallback((newToken: string, newUsername: string) => {
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_username', newUsername)
    setToken(newToken)
    setUsername(newUsername)
    // Reconnect socket with new token
    reconnectSocket()
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_username')
    setToken(null)
    setUsername(null)
    router.push('/login')
  }, [router])

  const getAuthHeader = useCallback((): Record<string, string> => {
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }, [token])

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        getAuthHeader,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
