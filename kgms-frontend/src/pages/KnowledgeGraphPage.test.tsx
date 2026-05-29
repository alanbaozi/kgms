import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KnowledgeGraphPage } from './KnowledgeGraphPage'
import { getKnowledgeGraph, getKnowledgeGraphLabels } from '../api/knowledgeGraph'
import type { KnowledgeGraphRead } from '../types/api'

vi.mock('../api/knowledgeGraph', () => ({
  getKnowledgeGraph: vi.fn(),
  getKnowledgeGraphLabels: vi.fn(),
}))

vi.mock('../components/GraphPanel', () => ({
  GraphPanel: ({
    graph,
    onExpand,
  }: {
    graph: { nodes: unknown[]; edges: unknown[] } | null
    onExpand?: () => void
  }) => (
    <section>
      知识图谱面板 {graph?.nodes.length || 0} 节点 {graph?.edges.length || 0} 关系
      {onExpand ? (
        <button type="button" onClick={onExpand}>
          放大知识图谱
        </button>
      ) : null}
    </section>
  ),
}))

const graphResponse: KnowledgeGraphRead = {
  label: '*',
  max_depth: 3,
  max_nodes: 300,
  is_truncated: true,
  node_count: 1,
  edge_count: 0,
  graph: {
    nodes: [
      {
        id: 'n1',
        label: '09III型核潜艇',
        entity_type: 'equipment',
        display_name: '装备',
        color: '#0891b2',
        properties: {},
      },
    ],
    edges: [],
  },
}

describe('KnowledgeGraphPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getKnowledgeGraph).mockResolvedValue(graphResponse)
    vi.mocked(getKnowledgeGraphLabels).mockResolvedValue({
      labels: ['09III型核潜艇', '相控阵雷达'],
      query: null,
      limit: 50,
    })
  })

  it('loads all graph data by default and shows truncation notice', async () => {
    render(<KnowledgeGraphPage />)

    expect(screen.getByText(/查看图谱服务当前知识库图谱/)).toBeInTheDocument()
    expect(await screen.findByDisplayValue('*')).toBeInTheDocument()
    await waitFor(() =>
      expect(getKnowledgeGraph).toHaveBeenCalledWith({
        label: '*',
        max_depth: 3,
        max_nodes: 100,
      }),
    )
    expect(screen.getByText('知识图谱面板 1 节点 0 关系')).toBeInTheDocument()
    expect(screen.getByText(/图谱已按最大节点数截断/)).toBeInTheDocument()
  })

  it('searches labels and queries a selected label', async () => {
    const user = userEvent.setup()
    render(<KnowledgeGraphPage />)

    await screen.findByDisplayValue('*')
    await user.clear(screen.getByLabelText('节点名称'))
    await user.type(screen.getByLabelText('节点名称'), '雷达')

    await waitFor(() =>
      expect(getKnowledgeGraphLabels).toHaveBeenCalledWith({ query: '雷达', limit: 50 }),
    )
    await user.click(screen.getByRole('button', { name: '最大节点数' }))
    await user.click(screen.getByRole('option', { name: '100 个节点' }))
    await user.click(screen.getByRole('button', { name: '最大深度' }))
    await user.click(screen.getByRole('option', { name: '2 跳' }))
    await user.click(screen.getByRole('button', { name: '查询图谱' }))

    await waitFor(() =>
      expect(getKnowledgeGraph).toHaveBeenLastCalledWith({
        label: '雷达',
        max_depth: 2,
        max_nodes: 100,
      }),
    )
  })

  it('shows searchable node suggestions that can be selected', async () => {
    const user = userEvent.setup()
    render(<KnowledgeGraphPage />)

    await screen.findByDisplayValue('*')
    await user.clear(screen.getByRole('combobox', { name: '节点名称' }))
    await user.type(screen.getByRole('combobox', { name: '节点名称' }), '09')

    await waitFor(() => expect(screen.getByRole('listbox', { name: '节点候选' })).toBeInTheDocument())
    await user.click(screen.getByRole('option', { name: '09III型核潜艇' }))

    expect(screen.getByRole('combobox', { name: '节点名称' })).toHaveValue('09III型核潜艇')
  })

  it('uses custom menus for max nodes and max depth', async () => {
    const user = userEvent.setup()
    render(<KnowledgeGraphPage />)

    await screen.findByDisplayValue('*')
    await user.click(screen.getByRole('button', { name: '最大节点数' }))
    expect(screen.getByRole('listbox', { name: '最大节点数选项' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: '20 个节点' }))

    await user.click(screen.getByRole('button', { name: '最大深度' }))
    expect(screen.getByRole('listbox', { name: '最大深度选项' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: '1 跳' }))

    await user.click(screen.getByRole('button', { name: '查询图谱' }))

    await waitFor(() =>
      expect(getKnowledgeGraph).toHaveBeenLastCalledWith({
        label: '*',
        max_depth: 1,
        max_nodes: 20,
      }),
    )
  })

  it('opens the knowledge graph in a focused dialog', async () => {
    const user = userEvent.setup()
    render(<KnowledgeGraphPage />)

    await screen.findByText('知识图谱面板 1 节点 0 关系')
    await user.click(screen.getByRole('button', { name: '放大知识图谱' }))

    expect(screen.getByRole('dialog', { name: '知识图谱' })).toBeInTheDocument()
    expect(screen.getAllByText(/知识图谱面板 1 节点 0 关系/)).toHaveLength(2)
  })
})
