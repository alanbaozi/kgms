import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GraphPanel } from './GraphPanel'
import type { GraphResponse } from '../types/api'

const chartMocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  init: vi.fn(),
  off: vi.fn(),
  on: vi.fn(),
  resize: vi.fn(),
  setOption: vi.fn(),
  use: vi.fn(),
}))

vi.mock('echarts/charts', () => ({
  GraphChart: {},
}))

vi.mock('echarts/components', () => ({
  TooltipComponent: {},
}))

vi.mock('echarts/renderers', () => ({
  CanvasRenderer: {},
}))

vi.mock('echarts/core', () => ({
  init: chartMocks.init,
  use: chartMocks.use,
}))

describe('GraphPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chartMocks.init.mockReturnValue({
      dispose: chartMocks.dispose,
      off: chartMocks.off,
      on: chartMocks.on,
      resize: chartMocks.resize,
      setOption: chartMocks.setOption,
    })
  })

  it('uses knowledge graph naming in the panel heading', () => {
    render(<GraphPanel graph={graphFixture} />)

    expect(screen.getByText('知识图谱')).toBeInTheDocument()
    expect(screen.queryByText('小图谱')).not.toBeInTheDocument()
  })

  it('shows an expand action when requested', () => {
    const onExpand = vi.fn()
    render(<GraphPanel graph={graphFixture} onExpand={onExpand} />)

    screen.getByRole('button', { name: '放大知识图谱' }).click()

    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('uses graph retrieval naming in the empty state', () => {
    render(<GraphPanel graph={{ nodes: [], edges: [] }} />)

    expect(screen.getByText('图谱检索没有为这个问题返回可展示的实体关系子图。')).toBeInTheDocument()
    expect(screen.queryByText(/LightRAG/)).not.toBeInTheDocument()
  })

  it('renders graph tooltips outside the clipped chart container', async () => {
    render(<GraphPanel graph={graphFixture} />)

    await waitFor(() => expect(chartMocks.setOption).toHaveBeenCalled())

    const option = chartMocks.setOption.mock.calls[0][0]
    expect(option.tooltip).toMatchObject({
      appendToBody: true,
      confine: false,
      renderMode: 'html',
    })
    expect(option.tooltip.extraCssText).toContain('max-width')
    expect(option.tooltip.extraCssText).toContain('max-height')
    expect(option.tooltip.extraCssText).toContain('overflow:auto')
    expect(option.tooltip.extraCssText).toContain('word-break')
  })

  it('uses normalized relation metadata in edge tooltips', async () => {
    render(<GraphPanel graph={relationMetadataGraphFixture} />)

    await waitFor(() => expect(chartMocks.setOption).toHaveBeenCalled())

    const option = chartMocks.setOption.mock.calls[0][0]
    const edgeData = option.series[0].links[0]
    const tooltip = option.tooltip.formatter({ dataType: 'edge', data: edgeData })
    expect(tooltip).toContain('名称')
    expect(tooltip).toContain('使用,来源')
    expect(tooltip).toContain('类型')
    expect(tooltip).toContain('有向关系')
    expect(tooltip).toContain('描述')
    expect(tooltip).toContain('边的完整描述')
    expect(tooltip).toContain('来源')
    expect(tooltip).toContain('强-6.pdf')
    expect(tooltip).not.toContain('properties')
  })

  it('keeps oversized graph tooltips inside the viewport', async () => {
    render(<GraphPanel graph={graphFixture} />)

    await waitFor(() => expect(chartMocks.setOption).toHaveBeenCalled())

    const option = chartMocks.setOption.mock.calls[0][0]
    expect(option.tooltip.position([12, 12], null, document.createElement('div'), null, {
      contentSize: [360, 520],
      viewSize: [800, 600],
    })).toEqual([28, 28])
    expect(option.tooltip.position([760, 560], null, document.createElement('div'), null, {
      contentSize: [360, 260],
      viewSize: [800, 600],
    })).toEqual([384, 284])
  })

  it('collapses and expands direct neighbors when a node is double clicked', async () => {
    render(<GraphPanel graph={collapsibleGraphFixture} />)

    await waitFor(() => expect(chartMocks.on).toHaveBeenCalledWith('dblclick', expect.any(Function)))
    expect(chartMocks.setOption.mock.calls[0][0].series[0].data).toHaveLength(3)

    const doubleClickHandler = chartMocks.on.mock.calls[0][1]
    act(() => {
      doubleClickHandler({ dataType: 'node', data: { id: 'core' } })
    })

    await waitFor(() => {
      const latestOption = latestSetOption()
      expect(latestOption.series[0].data.map((node: { id: string }) => node.id)).toEqual(['core'])
    })

    act(() => {
      doubleClickHandler({ dataType: 'node', data: { id: 'core' } })
    })

    await waitFor(() => {
      const latestOption = latestSetOption()
      expect(latestOption.series[0].data).toHaveLength(3)
    })
  })

  it('uses lighter rendering settings for large graphs', async () => {
    render(<GraphPanel graph={largeGraphFixture} />)

    await waitFor(() => expect(chartMocks.setOption).toHaveBeenCalled())

    const option = chartMocks.setOption.mock.calls[0][0]
    expect(option.animation).toBe(false)
    expect(option.animationDuration).toBe(0)
    expect(option.series[0].edgeLabel.show).toBe(false)
    expect(option.series[0].force.repulsion).toBeLessThan(160)
  })

  it('keeps relation labels visible for a medium graph and exposes a manual toggle', async () => {
    render(<GraphPanel graph={mediumDenseGraphFixture} />)

    await waitFor(() => expect(chartMocks.setOption).toHaveBeenCalled())
    expect(chartMocks.setOption.mock.calls[0][0].series[0].edgeLabel.show).toBe(true)

    act(() => {
      screen.getByRole('button', { name: '隐藏关系标签' }).click()
    })

    await waitFor(() => {
      expect(latestSetOption().series[0].edgeLabel.show).toBe(false)
    })
  })

  it('shows the color legend above the chart area', () => {
    render(<GraphPanel graph={collapsibleGraphFixture} />)

    expect(screen.getByText('颜色图示')).toBeInTheDocument()
    expect(screen.getByText('装备')).toBeInTheDocument()
    expect(screen.getByText('事件')).toBeInTheDocument()
  })

  it('disables force layout animation to prevent graph drift after dragging', async () => {
    render(<GraphPanel graph={collapsibleGraphFixture} />)

    await waitFor(() => expect(chartMocks.setOption).toHaveBeenCalled())

    const option = chartMocks.setOption.mock.calls[0][0]
    expect(option.animation).toBe(false)
    expect(option.series[0].layoutAnimation).toBe(false)
    expect(option.series[0].force.friction).toBeGreaterThanOrEqual(0.8)
  })
})

const graphFixture: GraphResponse = {
  nodes: [
    {
      id: '09III型核潜艇',
      label: '09III型核潜艇',
      entity_type: 'equipment',
      display_name: '装备',
      color: '#0891b2',
      properties: {
        说明: '用于验证较长节点信息不会被图谱画布裁切',
      },
    },
  ],
  edges: [],
}

const relationMetadataGraphFixture: GraphResponse = {
  nodes: [
    {
      id: 'source',
      label: '强-6',
      entity_type: 'equipment',
      display_name: '装备',
      color: '#0891b2',
      properties: {},
    },
    {
      id: 'target',
      label: '资料来源',
      entity_type: 'document',
      display_name: '文档',
      color: '#64748b',
      properties: {},
    },
  ],
  edges: [
    {
      source: 'source',
      target: 'target',
      label: '使用,来源',
      properties: {
        id: 147,
        type: 'DIRECTED',
        target: 113,
        properties: {
          keywords: '使用,来源',
          description: '边的完整描述',
          file_path: '强-6.pdf',
        },
      },
    },
  ],
}

const collapsibleGraphFixture: GraphResponse = {
  nodes: [
    {
      id: 'core',
      label: '核心节点',
      entity_type: 'equipment',
      display_name: '装备',
      color: '#0891b2',
      properties: {},
    },
    {
      id: 'neighbor-1',
      label: '邻居节点1',
      entity_type: 'organization',
      display_name: '组织',
      color: '#4f46e5',
      properties: {},
    },
    {
      id: 'neighbor-2',
      label: '邻居节点2',
      entity_type: 'event',
      display_name: '事件',
      color: '#f97316',
      properties: {},
    },
  ],
  edges: [
    { source: 'core', target: 'neighbor-1', label: '关联', properties: {} },
    { source: 'neighbor-2', target: 'core', label: '关联', properties: {} },
  ],
}

const largeGraphFixture: GraphResponse = {
  nodes: Array.from({ length: 150 }, (_, index) => ({
    id: `node-${index}`,
    label: `节点${index}`,
    entity_type: 'other',
    display_name: '其他',
    color: '#64748b',
    properties: {},
  })),
  edges: Array.from({ length: 149 }, (_, index) => ({
    source: `node-${index}`,
    target: `node-${index + 1}`,
    label: '关联',
    properties: {},
  })),
}

const mediumDenseGraphFixture: GraphResponse = {
  nodes: Array.from({ length: 50 }, (_, index) => ({
    id: `medium-node-${index}`,
    label: `节点${index}`,
    entity_type: index % 2 === 0 ? 'equipment' : 'event',
    display_name: index % 2 === 0 ? '装备' : '事件',
    color: index % 2 === 0 ? '#0891b2' : '#f97316',
    properties: {},
  })),
  edges: Array.from({ length: 156 }, (_, index) => ({
    source: `medium-node-${index % 50}`,
    target: `medium-node-${(index + 7) % 50}`,
    label: '关联',
    properties: {},
  })),
}

function latestSetOption() {
  const calls = chartMocks.setOption.mock.calls
  return calls[calls.length - 1][0]
}
