import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getDomainConfig,
  getSystemConfig,
  restartLightRAG,
  updateDomainConfig,
  updateSystemConfig,
} from './configuration'

describe('configuration api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('gets system configuration', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ kgms: {}, lightrag: {}, deployment: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getSystemConfig()

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/api/config/system', {
      headers: { accept: 'application/json' },
    })
  })

  it('updates system configuration', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ kgms: {}, lightrag: {}, deployment: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await updateSystemConfig({
      kgms: { lightrag_base_url: 'http://lightrag.example:9621' },
      lightrag: { llm_model: 'qwen3.6-plus' },
    })

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/api/config/system', {
      method: 'PUT',
      body: JSON.stringify({
        kgms: { lightrag_base_url: 'http://lightrag.example:9621' },
        lightrag: { llm_model: 'qwen3.6-plus' },
      }),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
    })
  })

  it('gets and updates domain configuration', async () => {
    const responseBody = JSON.stringify({ entity_types: [], relation_keywords: [] })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await getDomainConfig()
    await updateDomainConfig({
      entity_prompt_yaml: 'entity_types_guidance: |',
      qa_prompt_markdown: '回答规则',
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8000/api/config/domain',
      { headers: { accept: 'application/json' } },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8000/api/config/domain',
      {
        method: 'PUT',
        body: JSON.stringify({
          entity_prompt_yaml: 'entity_types_guidance: |',
          qa_prompt_markdown: '回答规则',
        }),
        headers: { accept: 'application/json', 'content-type': 'application/json' },
      },
    )
  })

  it('restarts the graph service', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'restarted', output: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await restartLightRAG()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/config/lightrag/restart',
      {
        method: 'POST',
        headers: { accept: 'application/json' },
      },
    )
  })
})
