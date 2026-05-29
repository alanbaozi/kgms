import { Maximize2 } from 'lucide-react'
import { useState } from 'react'

import { MarkdownAnswer } from './MarkdownAnswer'
import type { PageIndexHitRead } from '../types/api'

interface EvidencePanelProps {
  hits: PageIndexHitRead[]
  onExpand?: () => void
}

export function EvidencePanel({ hits, onExpand }: EvidencePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const visibleHits = expanded ? hits : hits.slice(0, 3)

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="font-semibold text-slate-950">文档检索原文证据</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">{hits.length} 条命中</div>
          {onExpand ? (
            <button
              aria-label="放大文档检索原文证据"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={onExpand}
              type="button"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {hits.length ? (
          <div className="space-y-3">
            {visibleHits.map((hit) => (
              <article key={hit.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-800">
                    {hit.title || hit.node_id || '文档检索结果'}
                  </div>
                  {hit.page_index !== null ? (
                    <div className="shrink-0 text-xs font-medium text-blue-700">
                      第 {hit.page_index} 页
                    </div>
                  ) : null}
                </div>
                <MarkdownAnswer
                  className="mt-2 space-y-3 text-sm leading-6 text-slate-600"
                  content={hit.relevant_content || '未返回原文片段'}
                />
              </article>
            ))}
            {hits.length > 3 ? (
              <button
                type="button"
                className="text-sm font-medium text-blue-700 hover:text-blue-800"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? '收起证据' : `展开全部 ${hits.length} 条证据`}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-24 items-center justify-center text-sm text-slate-500">
            未找到原文证据。
          </div>
        )}
      </div>
    </section>
  )
}
