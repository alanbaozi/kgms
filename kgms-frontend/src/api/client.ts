const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(buildUrl(path), buildOptions(options))

  if (!response.ok) {
    const payload = await parseResponse(response)
    throw new ApiError(errorMessage(payload, response.statusText), response.status, payload)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await parseResponse(response)) as T
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  const baseUrl = import.meta.env.VITE_KGMS_API_BASE_URL || DEFAULT_API_BASE_URL
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

function buildOptions(options: RequestInit): RequestInit {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return {
    ...options,
    headers: Object.fromEntries(headers.entries()),
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload) {
    return payload
  }
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail) {
      return detail
    }
  }
  return fallback || 'Request failed'
}
