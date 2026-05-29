import { afterEach, describe, expect, it, vi } from 'vitest'

import { getKnowledgeGraph, getKnowledgeGraphLabels } from './knowledgeGraph'

describe('knowledge graph api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('gets graph data with label depth and node limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ graph: { nodes: [], edges: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getKnowledgeGraph({ label: '*', max_depth: 3, max_nodes: 300 })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/knowledge-graph?label=*&max_depth=3&max_nodes=300',
      { headers: { accept: 'application/json' } },
    )
  })

  it('gets popular labels when query is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ labels: ['雷达'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getKnowledgeGraphLabels({ limit: 20 })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/knowledge-graph/labels?limit=20',
      { headers: { accept: 'application/json' } },
    )
  })

  it('searches labels when query is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ labels: ['相控阵雷达'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getKnowledgeGraphLabels({ query: '雷达', limit: 10 })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/knowledge-graph/labels?query=%E9%9B%B7%E8%BE%BE&limit=10',
      { headers: { accept: 'application/json' } },
    )
  })
})
