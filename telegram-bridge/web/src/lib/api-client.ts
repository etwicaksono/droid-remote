export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface ApiClientConfig {
  baseUrl: string
}

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl } = config

  async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new ApiError(response.status, await response.text())
    }

    return response.json() as Promise<T>
  }

  return {
    get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
    post: <T>(endpoint: string, body: unknown) =>
      request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    patch: <T>(endpoint: string, body: unknown) =>
      request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
  }
}

export const apiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/bridge',
})

// Image upload (multipart form data)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765'

export interface UploadImageResponse {
  success: boolean
  url: string
  public_id: string
  width?: number
  height?: number
  format?: string
  size?: number
}

export async function uploadImage(file: File, sessionId: string = 'unknown'): Promise<UploadImageResponse> {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('session_id', sessionId)

  const response = await fetch(`${API_BASE}/upload-image`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new ApiError(response.status, error)
  }

  return response.json()
}

export async function deleteImage(publicId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/delete-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_id: publicId }),
  })

  if (!response.ok) {
    throw new ApiError(response.status, await response.text())
  }

  return response.json()
}
