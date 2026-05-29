import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from './client'

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls the configured backend and parses JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ total: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiRequest<{ total: number }>('/api/documents')

    expect(result).toEqual({ total: 1 })
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/api/documents', {
      headers: { accept: 'application/json' },
    })
  })

  it('throws ApiError for failed HTTP responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'bad request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const error = await apiRequest('/api/documents').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      message: 'bad request',
    })
  })
})
