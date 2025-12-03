/**
 * API utility with authentication support
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean
}

/**
 * Authenticated fetch wrapper
 */
export async function apiFetch(
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipAuth, headers, ...rest } = options

  const authHeaders = skipAuth ? {} : getAuthHeaders()

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
  })

  // Handle 401 - redirect to login
  if (response.status === 401 && !skipAuth) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_username')
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }

  return response
}

/**
 * GET request with auth
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await apiFetch(endpoint)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }
  return res.json()
}

/**
 * POST request with auth
 */
export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
  const res = await apiFetch(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }
  return res.json()
}

/**
 * PUT request with auth
 */
export async function apiPut<T>(endpoint: string, data?: unknown): Promise<T> {
  const res = await apiFetch(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }
  return res.json()
}

/**
 * DELETE request with auth
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  const res = await apiFetch(endpoint, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }
  return res.json()
}

/**
 * PATCH request with auth
 */
export async function apiPatch<T>(endpoint: string, data?: unknown): Promise<T> {
  const res = await apiFetch(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }
  return res.json()
}
