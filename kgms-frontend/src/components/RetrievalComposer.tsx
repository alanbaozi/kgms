import { Send } from 'lucide-react'
import { FormEvent, useState } from 'react'

import { RETRIEVAL_MODE_OPTIONS } from '../lib/retrievalModes'
import type { RetrievalMode } from '../types/api'

interface RetrievalComposerProps {
  mode: RetrievalMode
  disabled?: boolean
  onModeChange: (mode: RetrievalMode) => void
  onSubmit: (query: string) => void
}

export function RetrievalComposer({
  mode,
  disabled = false,
  onModeChange,
  onSubmit,
}: RetrievalComposerProps) {
  const [query, setQuery] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || disabled) {
      return
    }
    onSubmit(trimmed)
  }

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-2 shadow-workbench"
      data-testid="retrieval-composer"
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-[180px_minmax(0,1fr)_auto]">
        <label
          className="min-w-0 border-b border-slate-200 bg-slate-50 md:border-b-0 md:border-r"
          data-testid="mode-control"
        >
          <span className="sr-only">检索模式</span>
          <select
            aria-label="检索模式"
            className="h-12 w-full border-0 bg-transparent px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-100"
            value={mode}
            onChange={(event) => onModeChange(event.currentTarget.value as RetrievalMode)}
          >
            {RETRIEVAL_MODE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0" data-testid="query-control">
          <span className="sr-only">检索问题</span>
          <textarea
            aria-label="检索问题"
            className="block max-h-28 min-h-12 w-full resize-none border-0 bg-transparent px-3 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-100"
            placeholder="输入军事知识检索问题..."
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            rows={1}
          />
        </label>
        <div className="flex items-center border-t border-slate-200 p-1 md:border-l md:border-t-0">
          <button
            type="submit"
            disabled={disabled || !query.trim()}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 md:w-auto"
          >
            <Send className="h-4 w-4" />
            发送
          </button>
        </div>
      </div>
    </form>
  )
}
