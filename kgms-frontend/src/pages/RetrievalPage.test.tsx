import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RetrievalPage } from './RetrievalPage'
import { queryRetrieval } from '../api/retrieval'
import { listDocuments } from '../api/documents'
import type { RetrievalMode, RetrievalResponse } from '../types/api'

vi.mock('../api/retrieval', () => ({
  queryRetrieval: vi.fn(),
}))

vi.mock('../api/documents', () => ({
  listDocuments: vi.fn(),
}))

vi.mock('../components/GraphPanel', () => ({
  GraphPanel: () => <section>知识图谱面板</section>,
}))

describe('RetrievalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listDocuments).mockResolvedValue({ items: [], total: 7 })
    vi.mocked(queryRetrieval).mockImplementation(async (request) =>
      responseForMode(request.mode),
    )
  })

  it('shows backend status summary in the header', async () => {
    render(<RetrievalPage />)

    expect(await screen.findByText('文档：7')).toBeInTheDocument()
    expect(screen.getByText('图谱检索：待检索')).toBeInTheDocument()
    expect(screen.getByText('文档检索：待检索')).toBeInTheDocument()
  })

  it('shows evidence and hides graph for pageindex mode', async () => {
    const user = userEvent.setup()
    render(<RetrievalPage />)

    await user.selectOptions(screen.getByLabelText('检索模式'), 'pageindex')
    await user.type(screen.getByLabelText('检索问题'), '哪一页提到武器')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('PageIndex answer')).toBeInTheDocument()
    expect(screen.getByText('文档检索原文证据')).toBeInTheDocument()
    expect(screen.queryByText('知识图谱面板')).not.toBeInTheDocument()
  })

  it('shows graph and hides evidence for lightrag mode', async () => {
    const user = userEvent.setup()
    render(<RetrievalPage />)

    await user.selectOptions(screen.getByLabelText('检索模式'), 'lightrag')
    await user.type(screen.getByLabelText('检索问题'), '装备关系是什么')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('LightRAG answer')).toBeInTheDocument()
    expect(screen.getByText('知识图谱面板')).toBeInTheDocument()
    expect(screen.queryByText('文档检索原文证据')).not.toBeInTheDocument()
  })

  it('renders answer, evidence and graph for hybrid mode', async () => {
    const user = userEvent.setup()
    render(<RetrievalPage />)

    await user.selectOptions(screen.getByLabelText('检索模式'), 'hybrid')
    await user.type(screen.getByLabelText('检索问题'), '综合说明')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('Hybrid answer')).toBeInTheDocument()
    expect(screen.getByText('文档检索原文证据')).toBeInTheDocument()
    expect(screen.getByText('知识图谱面板')).toBeInTheDocument()
  })

  it('keeps the graph slot visible for lightrag mode with an empty graph result', async () => {
    const user = userEvent.setup()
    vi.mocked(queryRetrieval).mockResolvedValueOnce({
      ...responseForMode('lightrag'),
      graph: { nodes: [], edges: [] },
    })
    render(<RetrievalPage />)

    await user.selectOptions(screen.getByLabelText('检索模式'), 'lightrag')
    await user.type(screen.getByLabelText('检索问题'), '没有图谱结果')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('LightRAG answer')).toBeInTheDocument()
    expect(screen.getByText('知识图谱面板')).toBeInTheDocument()
  })

  it('keeps the evidence slot visible for pageindex mode with no hits', async () => {
    const user = userEvent.setup()
    vi.mocked(queryRetrieval).mockResolvedValueOnce({
      ...responseForMode('pageindex'),
      pageindex_hits: [],
    })
    render(<RetrievalPage />)

    await user.selectOptions(screen.getByLabelText('检索模式'), 'pageindex')
    await user.type(screen.getByLabelText('检索问题'), '没有证据结果')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('PageIndex answer')).toBeInTheDocument()
    expect(screen.getByText('文档检索原文证据')).toBeInTheDocument()
  })

  it('uses responsive full layout with graph spanning the right side for hybrid mode', async () => {
    const user = userEvent.setup()
    render(<RetrievalPage />)

    await user.selectOptions(screen.getByLabelText('检索模式'), 'hybrid')
    await user.type(screen.getByLabelText('检索问题'), '综合说明')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('Hybrid answer')).toBeInTheDocument()
    expect(screen.getByTestId('retrieval-result-grid')).toHaveClass('xl:grid-cols-[minmax(560px,1.25fr)_minmax(340px,.85fr)]')
    expect(screen.getByTestId('graph-panel-slot')).toHaveClass('xl:row-span-2')
  })

  it('keeps long-result panels height bounded inside the result grid', async () => {
    const user = userEvent.setup()
    vi.mocked(queryRetrieval).mockResolvedValueOnce({
      ...responseForMode('hybrid'),
      answer: Array.from({ length: 24 }, (_, index) => `长回答段落 ${index + 1}`).join('\n\n'),
      pageindex_hits: [
        {
          id: 1,
          document_id: 1,
          query: 'query',
          node_id: null,
          title: '长证据',
          page_index: 4,
          relevant_content: Array.from({ length: 16 }, (_, index) => `证据行 ${index + 1}`).join('\n'),
          created_at: '2026-05-26T00:00:00Z',
        },
      ],
    })
    render(<RetrievalPage />)

    await user.selectOptions(screen.getByLabelText('检索模式'), 'hybrid')
    await user.type(screen.getByLabelText('检索问题'), '综合说明')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('长回答段落 1')).toBeInTheDocument()
    expect(screen.getByTestId('answer-panel-slot')).toHaveClass('h-full', 'overflow-hidden')
    expect(screen.getByTestId('evidence-panel-slot')).toHaveClass('h-full', 'overflow-hidden')
    expect(screen.getByTestId('graph-panel-slot')).toHaveClass('h-full', 'overflow-hidden')
  })

  it('opens the answer panel in a focused dialog', async () => {
    const user = userEvent.setup()
    render(<RetrievalPage />)

    await user.selectOptions(screen.getByLabelText('检索模式'), 'hybrid')
    await user.type(screen.getByLabelText('检索问题'), '综合说明')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('Hybrid answer')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '放大回答' }))

    expect(screen.getByRole('dialog', { name: '回答' })).toBeInTheDocument()
    expect(screen.getAllByText('Hybrid answer')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '关闭弹窗' }))

    expect(screen.queryByRole('dialog', { name: '回答' })).not.toBeInTheDocument()
  })

  it('opens document retrieval evidence in a focused dialog', async () => {
    const user = userEvent.setup()
    render(<RetrievalPage />)

    await user.selectOptions(screen.getByLabelText('检索模式'), 'hybrid')
    await user.type(screen.getByLabelText('检索问题'), '综合说明')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('文档检索原文证据')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '放大文档检索原文证据' }))

    expect(screen.getByRole('dialog', { name: '文档检索原文证据' })).toBeInTheDocument()
    expect(screen.getAllByText('文档检索结果')).toHaveLength(2)
  })
})

function responseForMode(mode: RetrievalMode): RetrievalResponse {
  const hasGraph = mode === 'lightrag' || mode === 'hybrid'
  const hasEvidence = mode === 'pageindex' || mode === 'hybrid'
  const label = mode === 'lightrag' ? 'LightRAG' : mode === 'pageindex' ? 'PageIndex' : 'Hybrid'
  return {
    answer: `${label} answer`,
    mode,
    route_reason: `Explicit retrieval mode: ${mode}`,
    sources: [],
    pageindex_hits: hasEvidence
      ? [
          {
            id: 1,
            document_id: 1,
            query: 'query',
            node_id: null,
            title: '',
            page_index: 4,
            relevant_content: '第4页提到武器。',
            created_at: '2026-05-26T00:00:00Z',
          },
        ]
      : [],
    graph: hasGraph
      ? {
          nodes: [
            {
              id: '09III型核潜艇',
              label: '09III型核潜艇',
              entity_type: 'equipment',
              display_name: '装备',
              color: '#0891b2',
              properties: {},
            },
          ],
          edges: [],
        }
      : null,
    diagnostics: {
      route_reason: `Explicit retrieval mode: ${mode}`,
      lightrag_status: hasGraph ? 'ok' : 'skipped',
      pageindex_status: hasEvidence ? 'ok' : 'skipped',
      timings_ms: {},
      errors: [],
    },
  }
}
