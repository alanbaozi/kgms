import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import { AnswerPanel } from '../components/AnswerPanel'
import { DiagnosticsBar } from '../components/DiagnosticsBar'
import { EvidencePanel } from '../components/EvidencePanel'
import { ExpandedPanelDialog } from '../components/ExpandedPanelDialog'
import { RetrievalComposer } from '../components/RetrievalComposer'
import { listDocuments } from '../api/documents'
import { queryRetrieval } from '../api/retrieval'
import { selectRetrievalLayout } from '../lib/retrievalLayout'
import { retrievalModeLabel } from '../lib/retrievalModes'
import type { RetrievalMode, RetrievalResponse } from '../types/api'

const GraphPanel = lazy(() =>
  import('../components/GraphPanel').then((module) => ({ default: module.GraphPanel })),
)

type ExpandedPanel = 'answer' | 'evidence' | 'graph'

export function RetrievalPage() {
  const [mode, setMode] = useState<RetrievalMode>('smart')
  const [response, setResponse] = useState<RetrievalResponse | null>(null)
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel | null>(null)
  const [documentTotal, setDocumentTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const layout = useMemo(() => selectRetrievalLayout(response, mode), [response, mode])

  useEffect(() => {
    let mounted = true
    listDocuments()
      .then((result) => {
        if (mounted) {
          setDocumentTotal(result.total)
        }
      })
      .catch(() => {
        if (mounted) {
          setDocumentTotal(null)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  async function handleSubmit(query: string) {
    setLoading(true)
    setError(null)
    try {
      const result = await queryRetrieval({
        query,
        mode,
        top_k: 5,
        filters: {},
        include_graph: true,
        include_pageindex_snippets: true,
      })
      setResponse(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '检索失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden px-6 py-5">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">知识检索</h1>
          <p className="mt-1 text-sm text-slate-500">
            统一调用图谱检索、文档检索或混合检索，并展示答案、证据和知识图谱。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            文档：{documentTotal ?? '-'}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            图谱检索：{response?.diagnostics.lightrag_status || '待检索'}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            文档检索：{response?.diagnostics.pageindex_status || '待检索'}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            模式：{retrievalModeLabel(mode)}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            top_k: 5
          </span>
        </div>
      </header>

      <main className={resultGridClass(layout.variant)} data-testid="retrieval-result-grid">
        <div
          className="h-full min-h-0 overflow-hidden"
          data-testid="answer-panel-slot"
        >
          <AnswerPanel
            answer={response?.answer || ''}
            loading={loading}
            onExpand={response ? () => setExpandedPanel('answer') : undefined}
            sources={response?.sources || []}
          />
        </div>
        {layout.showGraph ? (
          <div className={graphSlotClass(layout.variant)} data-testid="graph-panel-slot">
            <Suspense
              fallback={
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  正在加载知识图谱...
                </div>
              }
            >
              <GraphPanel
                graph={response?.graph || null}
                onExpand={response ? () => setExpandedPanel('graph') : undefined}
              />
            </Suspense>
          </div>
        ) : null}
        {layout.showEvidence ? (
          <div
            className="h-full min-h-0 overflow-hidden"
            data-testid="evidence-panel-slot"
          >
            <EvidencePanel
              hits={response?.pageindex_hits || []}
              onExpand={response ? () => setExpandedPanel('evidence') : undefined}
            />
          </div>
        ) : null}
      </main>

      <div className="space-y-2">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {response ? (
          <DiagnosticsBar diagnostics={response.diagnostics} routeReason={response.route_reason} />
        ) : null}
        <RetrievalComposer
          mode={mode}
          disabled={loading}
          onModeChange={setMode}
          onSubmit={handleSubmit}
        />
      </div>
      {expandedPanel ? (
        <ExpandedPanelDialog
          title={expandedPanelTitle(expandedPanel)}
          onClose={() => setExpandedPanel(null)}
        >
          {renderExpandedPanel(expandedPanel, response)}
        </ExpandedPanelDialog>
      ) : null}
    </div>
  )
}

function expandedPanelTitle(panel: ExpandedPanel): string {
  if (panel === 'answer') {
    return '回答'
  }
  if (panel === 'evidence') {
    return '文档检索原文证据'
  }
  return '知识图谱'
}

function renderExpandedPanel(panel: ExpandedPanel, response: RetrievalResponse | null) {
  if (panel === 'answer') {
    return <AnswerPanel answer={response?.answer || ''} sources={response?.sources || []} />
  }
  if (panel === 'evidence') {
    return <EvidencePanel hits={response?.pageindex_hits || []} />
  }
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          正在加载知识图谱...
        </div>
      }
    >
      <GraphPanel graph={response?.graph || null} />
    </Suspense>
  )
}

function resultGridClass(variant: string): string {
  const base = 'min-h-0 grid grid-cols-1 gap-3 overflow-auto xl:overflow-hidden'
  if (variant === 'full') {
    return `${base} xl:grid-cols-[minmax(560px,1.25fr)_minmax(340px,.85fr)] xl:grid-rows-[minmax(0,1fr)_minmax(140px,220px)]`
  }
  if (variant === 'answer-graph') {
    return `${base} xl:grid-cols-[minmax(560px,1.25fr)_minmax(340px,.85fr)]`
  }
  if (variant === 'answer-evidence') {
    return `${base} xl:grid-rows-[minmax(0,1fr)_minmax(140px,220px)]`
  }
  return base
}

function graphSlotClass(variant: string): string {
  const base = 'h-full min-h-0 overflow-hidden'
  if (variant === 'full') {
    return `${base} xl:row-span-2`
  }
  return base
}
