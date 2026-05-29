import { GraphChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { Maximize2, Tags } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { EmptyState } from './EmptyState'
import { entityColor, entityLabel, graphLegend } from '../lib/entityColors'
import { formatGraphTooltip } from '../lib/graphTooltip'
import type { GraphResponse } from '../types/api'

use([GraphChart, TooltipComponent, CanvasRenderer])

interface GraphPanelProps {
  graph: GraphResponse | null
  onExpand?: () => void
}

interface GraphDoubleClickEvent {
  dataType?: string
  data?: unknown
  name?: string
}

const LARGE_GRAPH_NODE_THRESHOLD = 120
const EDGE_LABEL_THRESHOLD = 220
const EDGE_LABEL_NODE_THRESHOLD = 80

export function GraphPanel({ graph, onExpand }: GraphPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set())
  const [showRelationLabels, setShowRelationLabels] = useState(true)
  const neighborIdsByNode = useMemo(() => buildNeighborIdsByNode(graph), [graph])
  const visibleGraph = useMemo(
    () => filterCollapsedGraph(graph, collapsedNodeIds, neighborIdsByNode),
    [collapsedNodeIds, graph, neighborIdsByNode],
  )
  const legend = useMemo(
    () => graphLegend(visibleGraph?.nodes.map((node) => node.entity_type) || []),
    [visibleGraph],
  )
  const isLargeGraph = (visibleGraph?.nodes.length || 0) >= LARGE_GRAPH_NODE_THRESHOLD
  const showEdgeLabels =
    showRelationLabels &&
    !isLargeGraph &&
    (visibleGraph?.nodes.length || 0) <= EDGE_LABEL_NODE_THRESHOLD &&
    (visibleGraph?.edges.length || 0) <= EDGE_LABEL_THRESHOLD

  useEffect(() => {
    setCollapsedNodeIds(new Set())
  }, [graph])

  useEffect(() => {
    if (!containerRef.current || !visibleGraph?.nodes.length) {
      return
    }

    const chart = init(containerRef.current)
    chart.setOption({
      animation: false,
      animationDuration: 0,
      tooltip: {
        appendTo: () => document.body,
        appendToBody: true,
        className: 'kgms-graph-tooltip',
        confine: false,
        enterable: true,
        extraCssText:
          'max-width:520px;max-height:min(440px,calc(100vh - 32px));overflow:auto;white-space:normal;word-break:break-word;overflow-wrap:anywhere;line-height:1.6;z-index:9999;',
        formatter: formatGraphTooltip,
        position: positionGraphTooltip,
        renderMode: 'html',
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          layoutAnimation: false,
          roam: true,
          draggable: true,
          progressive: 200,
          progressiveThreshold: 300,
          label: {
            show: visibleGraph.nodes.length <= 250,
            fontSize: isLargeGraph ? 10 : 11,
            color: '#1f2937',
          },
          edgeLabel: {
            show: showEdgeLabels,
            formatter: '{c}',
            fontSize: 10,
            color: '#64748b',
          },
          lineStyle: {
            color: '#94a3b8',
            opacity: 0.8,
          },
          force: {
            repulsion: isLargeGraph ? 90 : 160,
            edgeLength: isLargeGraph ? 58 : 85,
            friction: 0.86,
            gravity: 0.04,
          },
          data: visibleGraph.nodes.map((node) => ({
            id: node.id,
            name: node.label,
            categoryLabel: node.display_name || entityLabel(node.entity_type),
            properties: node.properties,
            symbolSize: isLargeGraph ? 28 : 38,
            itemStyle: {
              color: node.color || entityColor(node.entity_type),
            },
          })),
          links: visibleGraph.edges.map((edge) => ({
            source: edge.source,
            target: edge.target,
            value: edge.label,
            label: edge.label,
            properties: edge.properties,
          })),
        },
      ],
    })

    const toggleNeighborhood = (event: unknown) => {
      const nodeId = nodeIdFromDoubleClickEvent(event)
      if (!nodeId || !neighborIdsByNode.get(nodeId)?.size) {
        return
      }
      setCollapsedNodeIds((current) => {
        const next = new Set(current)
        if (next.has(nodeId)) {
          next.delete(nodeId)
        } else {
          next.add(nodeId)
        }
        return next
      })
    }

    chart.on('dblclick', toggleNeighborhood)

    const resize = () => chart.resize()
    let resizeObserver: ResizeObserver | null = null
    window.addEventListener('resize', resize)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(containerRef.current)
    }
    return () => {
      window.removeEventListener('resize', resize)
      resizeObserver?.disconnect()
      chart.off('dblclick', toggleNeighborhood)
      chart.dispose()
    }
  }, [isLargeGraph, neighborIdsByNode, showEdgeLabels, visibleGraph])

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="font-semibold text-slate-950">知识图谱</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">
            {visibleGraph?.nodes.length || 0}
            {graph?.nodes.length && visibleGraph?.nodes.length !== graph.nodes.length
              ? `/${graph.nodes.length}`
              : ''}{' '}
            节点 · {visibleGraph?.edges.length || 0} 关系
          </div>
          {onExpand ? (
            <button
              aria-label="放大知识图谱"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={onExpand}
              type="button"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : null}
          {visibleGraph?.nodes.length ? (
            <button
              aria-label={showRelationLabels ? '隐藏关系标签' : '显示关系标签'}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium ${
                showRelationLabels
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
              onClick={() => setShowRelationLabels((current) => !current)}
              type="button"
            >
              <Tags className="h-3.5 w-3.5" />
              关系标签
            </button>
          ) : null}
        </div>
      </div>
      {visibleGraph?.nodes.length ? (
        <div className="border-b border-slate-100 px-4 py-2">
          <div className="flex items-center gap-3 overflow-x-auto">
            <span className="shrink-0 text-xs font-medium text-slate-500">颜色图示</span>
            <div className="flex min-w-0 flex-wrap gap-2">
              {legend.map((item) => (
                <span
                  key={item.type}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 p-3">
        {visibleGraph?.nodes.length ? (
          <div className="flex h-full min-h-[260px] flex-col xl:min-h-0">
            <div ref={containerRef} className="min-h-0 flex-1 rounded-lg bg-slate-50" />
          </div>
        ) : (
          <EmptyState title="本次未召回知识图谱" description="图谱检索没有为这个问题返回可展示的实体关系子图。" />
        )}
      </div>
    </section>
  )
}

function buildNeighborIdsByNode(graph: GraphResponse | null): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  if (!graph) {
    return result
  }

  for (const node of graph.nodes) {
    result.set(node.id, new Set())
  }

  for (const edge of graph.edges) {
    result.get(edge.source)?.add(edge.target)
    result.get(edge.target)?.add(edge.source)
  }

  return result
}

function filterCollapsedGraph(
  graph: GraphResponse | null,
  collapsedNodeIds: Set<string>,
  neighborIdsByNode: Map<string, Set<string>>,
): GraphResponse | null {
  if (!graph || collapsedNodeIds.size === 0) {
    return graph
  }

  const hiddenNodeIds = new Set<string>()
  for (const nodeId of collapsedNodeIds) {
    for (const neighborId of neighborIdsByNode.get(nodeId) || []) {
      if (!collapsedNodeIds.has(neighborId)) {
        hiddenNodeIds.add(neighborId)
      }
    }
  }

  if (hiddenNodeIds.size === 0) {
    return graph
  }

  return {
    nodes: graph.nodes.filter((node) => !hiddenNodeIds.has(node.id)),
    edges: graph.edges.filter(
      (edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target),
    ),
  }
}

function nodeIdFromDoubleClickEvent(event: unknown): string | null {
  if (!isGraphDoubleClickEvent(event) || event.dataType !== 'node') {
    return null
  }

  const data = event.data
  if (isRecord(data)) {
    const id = data.id
    const name = data.name
    if (typeof id === 'string') {
      return id
    }
    if (typeof name === 'string') {
      return name
    }
  }

  return typeof event.name === 'string' ? event.name : null
}

function isGraphDoubleClickEvent(event: unknown): event is GraphDoubleClickEvent {
  return isRecord(event)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function positionGraphTooltip(
  point: number[],
  _params: unknown,
  _dom: HTMLElement,
  _rect: unknown,
  size: { contentSize?: number[]; viewSize?: number[] },
): [number, number] {
  const gap = 16
  const [contentWidth = 360, contentHeight = 240] = size.contentSize || []
  const [viewWidth = window.innerWidth, viewHeight = window.innerHeight] = size.viewSize || []
  const maxX = Math.max(gap, viewWidth - contentWidth - gap)
  const maxY = Math.max(gap, viewHeight - contentHeight - gap)
  const preferredX = point[0] + gap
  const preferredY = point[1] + gap
  const x = preferredX > maxX ? point[0] - contentWidth - gap : preferredX
  const y = preferredY > maxY ? point[1] - contentHeight - gap : preferredY

  return [clamp(x, gap, maxX), clamp(y, gap, maxY)]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
