import type { RetrievalDiagnostics } from '../types/api'

interface DiagnosticsBarProps {
  diagnostics: RetrievalDiagnostics | null
  routeReason?: string | null
}

export function DiagnosticsBar({ diagnostics, routeReason }: DiagnosticsBarProps) {
  if (!diagnostics) {
    return null
  }

  const timings = Object.entries(diagnostics.timings_ms)
    .map(([key, value]) => `${key}: ${Math.round(value)}ms`)
    .join(' · ')

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>{routeReason || diagnostics.route_reason || '无路由说明'}</span>
        {diagnostics.lightrag_status ? (
          <span>图谱检索：{diagnostics.lightrag_status}</span>
        ) : null}
        {diagnostics.pageindex_status ? (
          <span>文档检索：{diagnostics.pageindex_status}</span>
        ) : null}
        {timings ? <span>{timings}</span> : null}
      </div>
      {diagnostics.errors.length ? (
        <div className="mt-1 text-amber-700">{diagnostics.errors.join('；')}</div>
      ) : null}
    </div>
  )
}
