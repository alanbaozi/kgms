import { describe, expect, it } from 'vitest'

import { selectRetrievalLayout } from './retrievalLayout'
import type { RetrievalResponse } from '../types/api'

describe('selectRetrievalLayout', () => {
  it('shows answer only for native mode', () => {
    expect(selectRetrievalLayout(response({ mode: 'native' }))).toMatchObject({
      variant: 'answer-only',
      showGraph: false,
      showEvidence: false,
    })
  })

  it('shows answer and graph for lightrag mode when graph has nodes', () => {
    expect(selectRetrievalLayout(response({ mode: 'lightrag', graphNodes: 1 }))).toMatchObject({
      variant: 'answer-graph',
      showGraph: true,
      showEvidence: false,
    })
  })

  it('keeps graph panel visible for lightrag mode even when no graph nodes are returned', () => {
    expect(selectRetrievalLayout(response({ mode: 'lightrag', graphNodes: 0 }))).toMatchObject({
      variant: 'answer-graph',
      showGraph: true,
      showEvidence: false,
    })
  })

  it('shows answer and evidence for pageindex mode when hits are present', () => {
    expect(selectRetrievalLayout(response({ mode: 'pageindex', hits: 1 }))).toMatchObject({
      variant: 'answer-evidence',
      showGraph: false,
      showEvidence: true,
    })
  })

  it('keeps evidence panel visible for pageindex mode even when no hits are returned', () => {
    expect(selectRetrievalLayout(response({ mode: 'pageindex', hits: 0 }))).toMatchObject({
      variant: 'answer-evidence',
      showGraph: false,
      showEvidence: true,
    })
  })

  it('shows all panels for hybrid when graph and hits are present', () => {
    expect(
      selectRetrievalLayout(response({ mode: 'hybrid', graphNodes: 1, hits: 1 })),
    ).toMatchObject({
      variant: 'full',
      showGraph: true,
      showEvidence: true,
    })
  })

  it('keeps both side panels visible for hybrid mode even when one source is empty', () => {
    expect(selectRetrievalLayout(response({ mode: 'hybrid' }))).toMatchObject({
      variant: 'full',
      showGraph: true,
      showEvidence: true,
    })
  })

  it('uses returned response mode for smart routing', () => {
    expect(selectRetrievalLayout(response({ mode: 'pageindex', hits: 1 }), 'smart')).toMatchObject({
      variant: 'answer-evidence',
      showGraph: false,
      showEvidence: true,
    })
  })
})

function response({
  mode,
  graphNodes = 0,
  hits = 0,
}: {
  mode: RetrievalResponse['mode']
  graphNodes?: number
  hits?: number
}): RetrievalResponse {
  return {
    answer: 'answer',
    mode,
    route_reason: null,
    sources: [],
    pageindex_hits: Array.from({ length: hits }, (_, index) => ({
      id: index + 1,
      document_id: 1,
      query: 'query',
      node_id: `node-${index}`,
      title: '证据',
      page_index: 1,
      relevant_content: '原文证据',
      created_at: '2026-05-26T00:00:00Z',
    })),
    graph: {
      nodes: Array.from({ length: graphNodes }, (_, index) => ({
        id: `node-${index}`,
        label: `节点 ${index}`,
        entity_type: 'equipment',
        display_name: '装备',
        color: '#0891b2',
        properties: {},
      })),
      edges: [],
    },
    diagnostics: {
      route_reason: null,
      lightrag_status: null,
      pageindex_status: null,
      timings_ms: {},
      errors: [],
    },
  }
}
