import type { JobStatus } from '../types/api'

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  synced: 'bg-blue-50 text-blue-700 ring-blue-200',
  parsing: 'bg-amber-50 text-amber-700 ring-amber-200',
  analyzing: 'bg-amber-50 text-amber-700 ring-amber-200',
  processing: 'bg-amber-50 text-amber-700 ring-amber-200',
  preprocessed: 'bg-amber-50 text-amber-700 ring-amber-200',
  uploaded: 'bg-slate-50 text-slate-700 ring-slate-200',
  pending: 'bg-slate-50 text-slate-700 ring-slate-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  skipped: 'bg-slate-100 text-slate-500 ring-slate-200',
  unknown: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
}

const STATUS_LABELS: Record<string, string> = {
  completed: '完成',
  synced: '完成',
  parsing: '解析中',
  analyzing: '分析中',
  processing: '进行中',
  preprocessed: '待抽取',
  uploaded: '等待中',
  pending: '等待中',
  failed: '失败',
  skipped: '未启用',
  unknown: '未知',
}

export function StatusBadge({ status }: { status: JobStatus | null | undefined }) {
  const value = String(status || 'unknown').toLowerCase()
  const style = STATUS_STYLES[value] || STATUS_STYLES.unknown
  const label = STATUS_LABELS[value] || STATUS_LABELS.unknown
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  )
}
