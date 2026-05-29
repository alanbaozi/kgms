import { ChevronDown, RefreshCw, Search } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { getKnowledgeGraph, getKnowledgeGraphLabels } from '../api/knowledgeGraph'
import { ExpandedPanelDialog } from '../components/ExpandedPanelDialog'
import type { GraphLabelsResponse, KnowledgeGraphRead } from '../types/api'

const GraphPanel = lazy(() =>
  import('../components/GraphPanel').then((module) => ({ default: module.GraphPanel })),
)

const DEFAULT_MAX_NODES = 100
const MAX_NODE_OPTIONS = [20, 50, 100, 300, 500, 1000]
const MAX_DEPTH_OPTIONS = [1, 2, 3, 4, 5]
type NumberMenuId = 'maxNodes' | 'maxDepth'

export function KnowledgeGraphPage() {
  const [label, setLabel] = useState('*')
  const [maxNodes, setMaxNodes] = useState(DEFAULT_MAX_NODES)
  const [maxDepth, setMaxDepth] = useState(3)
  const [labels, setLabels] = useState<string[]>([])
  const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false)
  const [openNumberMenu, setOpenNumberMenu] = useState<NumberMenuId | null>(null)
  const [graphData, setGraphData] = useState<KnowledgeGraphRead | null>(null)
  const [isGraphExpanded, setIsGraphExpanded] = useState(false)
  const [loadingGraph, setLoadingGraph] = useState(true)
  const [loadingLabels, setLoadingLabels] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedLabel = useMemo(() => label.trim() || '*', [label])
  const labelOptions = useMemo(() => {
    const query = label.trim()
    const values = query && query !== '*' ? labels : ['*', ...labels]
    return Array.from(new Set(values)).slice(0, 50)
  }, [label, labels])
  const showLabelOptions = isLabelMenuOpen && labelOptions.length > 0

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLabels(label)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [label])

  useEffect(() => {
    void loadGraph({ label: '*', max_depth: 3, max_nodes: DEFAULT_MAX_NODES })
  }, [])

  async function loadLabels(nextLabel: string) {
    setLoadingLabels(true)
    try {
      const query = nextLabel.trim()
      const result: GraphLabelsResponse =
        query && query !== '*'
          ? await getKnowledgeGraphLabels({ query, limit: 50 })
          : await getKnowledgeGraphLabels({ limit: 50 })
      setLabels(result.labels)
    } catch {
      setLabels([])
    } finally {
      setLoadingLabels(false)
    }
  }

  async function loadGraph(query = { label: trimmedLabel, max_depth: maxDepth, max_nodes: maxNodes }) {
    setLoadingGraph(true)
    setError(null)
    try {
      const result = await getKnowledgeGraph(query)
      setGraphData(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '图谱加载失败')
    } finally {
      setLoadingGraph(false)
    }
  }

  function selectLabel(nextLabel: string) {
    setLabel(nextLabel)
    setIsLabelMenuOpen(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadGraph({ label: trimmedLabel, max_depth: maxDepth, max_nodes: maxNodes })
  }

  return (
    <div className="grid h-screen min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 overflow-hidden px-6 py-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950">知识图谱</h1>
        <p className="mt-1 text-sm text-slate-500">
          查看图谱服务当前知识库图谱；默认使用 * 查询全量图谱，并通过节点数量限制控制规模。
        </p>
      </header>

      <form
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_160px_140px_auto]">
          <div className="relative block min-w-0 text-sm">
            <label className="font-medium text-slate-700" htmlFor="knowledge-graph-label-input">
              节点名称
            </label>
            <div className="relative mt-1">
              <input
                aria-autocomplete="list"
                aria-controls="knowledge-graph-label-list"
                aria-expanded={showLabelOptions}
                aria-label="节点名称"
                id="knowledge-graph-label-input"
                role="combobox"
                value={label}
                onBlur={() => setIsLabelMenuOpen(false)}
                onChange={(event) => {
                  setLabel(event.target.value)
                  setIsLabelMenuOpen(true)
                }}
                onFocus={() => setIsLabelMenuOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setIsLabelMenuOpen(false)
                  }
                }}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                aria-label="展开节点候选"
                className="absolute inset-y-0 right-1 inline-flex w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setIsLabelMenuOpen((current) => !current)}
                type="button"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            {showLabelOptions ? (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <ul aria-label="节点候选" id="knowledge-graph-label-list" role="listbox">
                  {labelOptions.map((item) => (
                    <li key={item}>
                      <button
                        aria-selected={item === label}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          selectLabel(item)
                        }}
                        role="option"
                        type="button"
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <NumberMenu
            id="maxNodes"
            label="最大节点数"
            listLabel="最大节点数选项"
            value={maxNodes}
            options={MAX_NODE_OPTIONS}
            formatOption={(value) => `${value} 个节点`}
            isOpen={openNumberMenu === 'maxNodes'}
            onOpenChange={(isOpen) => setOpenNumberMenu(isOpen ? 'maxNodes' : null)}
            onChange={setMaxNodes}
          />

          <NumberMenu
            id="maxDepth"
            label="最大深度"
            listLabel="最大深度选项"
            value={maxDepth}
            options={MAX_DEPTH_OPTIONS}
            formatOption={(value) => `${value} 跳`}
            isOpen={openNumberMenu === 'maxDepth'}
            onOpenChange={(isOpen) => setOpenNumberMenu(isOpen ? 'maxDepth' : null)}
            onChange={setMaxDepth}
          />

          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={loadingGraph}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              查询图谱
            </button>
            <button
              type="button"
              onClick={() => loadGraph()}
              disabled={loadingGraph}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loadingGraph ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            当前 label：{graphData?.label || trimmedLabel}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            节点：{graphData?.node_count ?? 0}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            关系：{graphData?.edge_count ?? 0}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            候选节点：{loadingLabels ? '加载中' : labels.length}
          </span>
        </div>
      </form>

      <main className="min-h-0 overflow-hidden">
        {error ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {graphData?.is_truncated ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            图谱已按最大节点数截断，可以缩小节点范围或提高最大节点数。
          </div>
        ) : null}
        <div className="h-full min-h-0">
          <Suspense
            fallback={
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                正在加载知识图谱...
              </div>
            }
          >
            <GraphPanel
              graph={graphData?.graph || null}
              onExpand={graphData ? () => setIsGraphExpanded(true) : undefined}
            />
          </Suspense>
        </div>
      </main>
      {isGraphExpanded ? (
        <ExpandedPanelDialog title="知识图谱" onClose={() => setIsGraphExpanded(false)}>
          <Suspense
            fallback={
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                正在加载知识图谱...
              </div>
            }
          >
            <GraphPanel graph={graphData?.graph || null} />
          </Suspense>
        </ExpandedPanelDialog>
      ) : null}
    </div>
  )
}

interface NumberMenuProps {
  id: NumberMenuId
  label: string
  listLabel: string
  value: number
  options: number[]
  formatOption: (value: number) => string
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onChange: (value: number) => void
}

function NumberMenu({
  id,
  label,
  listLabel,
  value,
  options,
  formatOption,
  isOpen,
  onOpenChange,
  onChange,
}: NumberMenuProps) {
  return (
    <div className="relative block text-sm">
      <label className="font-medium text-slate-700" id={`${id}-label`}>
        {label}
      </label>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label}
        aria-labelledby={`${id}-label`}
        className="mt-1 flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 outline-none hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        onClick={() => onOpenChange(!isOpen)}
        type="button"
      >
        <span className="truncate">{formatOption(value)}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <ul aria-label={listLabel} role="listbox">
            {options.map((option) => (
              <li key={option}>
                <button
                  aria-selected={option === value}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    option === value
                      ? 'bg-blue-50 font-medium text-blue-700'
                      : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                  onClick={() => {
                    onChange(option)
                    onOpenChange(false)
                  }}
                  role="option"
                  type="button"
                >
                  {formatOption(option)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
