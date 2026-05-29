import { Copy, Maximize2 } from 'lucide-react'

import { MarkdownAnswer } from './MarkdownAnswer'

interface AnswerPanelProps {
  answer: string
  onExpand?: () => void
  sources?: Record<string, unknown>[]
  loading?: boolean
}

export function AnswerPanel({
  answer,
  onExpand,
  sources = [],
  loading = false,
}: AnswerPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="font-semibold text-slate-950">回答</div>
        <div className="flex items-center gap-1">
          {answer ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
              onClick={() => void navigator.clipboard?.writeText(answer)}
            >
              <Copy className="h-3.5 w-3.5" />
              复制
            </button>
          ) : null}
          {onExpand ? (
            <button
              aria-label="放大回答"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={onExpand}
              type="button"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
          </div>
        ) : answer ? (
          <MarkdownAnswer content={answer} />
        ) : (
          <div className="flex h-full min-h-36 items-center justify-center text-sm text-slate-500">
            输入问题后会在这里显示检索回答。
          </div>
        )}
      </div>
      {sources.length ? (
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          来源：{sources.length} 条
        </div>
      ) : null}
    </section>
  )
}
