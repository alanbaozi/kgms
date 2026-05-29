import { RefreshCw, Trash2 } from 'lucide-react'

import { StatusBadge } from './StatusBadge'
import { formatBytes, formatDateTime, shortId } from '../lib/format'
import type { DocumentRead } from '../types/api'

interface DocumentTableProps {
  documents: DocumentRead[]
  onSyncLightRAG?: (documentId: number) => void
  onSyncPageIndex?: (documentId: number) => void
  onDeleteDocument?: (document: DocumentRead) => void
  deletingDocumentId?: number | null
}

export function DocumentTable({
  documents,
  onSyncLightRAG,
  onSyncPageIndex,
  onDeleteDocument,
  deletingDocumentId = null,
}: DocumentTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">文件</th>
            <th className="px-4 py-3">构建目标</th>
            <th className="px-4 py-3">图谱构建</th>
            <th className="px-4 py-3">索引构建</th>
            <th className="px-4 py-3">更新时间</th>
            <th className="px-4 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {documents.map((document) => (
            <tr key={document.id} className="hover:bg-slate-50/70">
              <td className="max-w-[360px] px-4 py-4">
                <div className="truncate font-medium text-slate-950">
                  {document.original_filename}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  图谱构建 {shortId(document.lightrag_doc_id || document.lightrag_track_id)} ·
                  索引构建 {shortId(document.pageindex_doc_id)} ·{' '}
                  {formatBytes(document.size_bytes)}
                </div>
              </td>
              <td className="px-4 py-4 text-slate-600">{indexTargetLabel(document)}</td>
              <td className="px-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <StatusBadge status={document.lightrag_status} />
                  {document.lightrag_error ? (
                    <span className="max-w-48 truncate text-xs text-red-600">
                      {document.lightrag_error}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <StatusBadge status={document.pageindex_status} />
                  {document.pageindex_error ? (
                    <span className="max-w-48 truncate text-xs text-red-600">
                      {document.pageindex_error}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-4 text-slate-500">
                {formatDateTime(document.updated_at)}
              </td>
              <td className="px-4 py-4 text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    onClick={() => onSyncLightRAG?.(document.id)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    图谱构建
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    onClick={() => onSyncPageIndex?.(document.id)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    索引构建
                  </button>
                  <button
                    type="button"
                    aria-label={`删除文档 ${document.original_filename}`}
                    title="删除文档"
                    className="inline-flex items-center justify-center rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={deletingDocumentId === document.id}
                    onClick={() => onDeleteDocument?.(document)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function indexTargetLabel(document: DocumentRead): string {
  const lightSkipped = document.lightrag_status === 'skipped'
  const pageSkipped = document.pageindex_status === 'skipped'
  if (!lightSkipped && !pageSkipped) {
    return '混合构建'
  }
  if (!lightSkipped) {
    return '仅图谱构建'
  }
  if (!pageSkipped) {
    return '仅索引构建'
  }
  return '未启用'
}
