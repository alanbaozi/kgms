import { RefreshCw, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { DocumentTable } from '../components/DocumentTable'
import { EmptyState } from '../components/EmptyState'
import { UploadDialog } from '../components/UploadDialog'
import {
  deleteDocument,
  listDocuments,
  syncDocumentStatuses,
  syncLightRAGDocument,
  syncPageIndexDocument,
  uploadDocument,
} from '../api/documents'
import type { DocumentRead, IndexTarget } from '../types/api'

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRead[]>([])
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const loadDocuments = useCallback(async ({ clearError = true }: { clearError?: boolean } = {}) => {
    if (clearError) {
      setError(null)
    }
    const response = await listDocuments()
    setDocuments(response.items)
    setTotalDocuments(response.total)
  }, [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    loadDocuments()
      .catch((caught: unknown) => {
        if (mounted) {
          setError(errorMessage(caught))
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    const interval = window.setInterval(() => {
      syncDocumentStatuses()
        .then(() => loadDocuments())
        .catch(() => undefined)
    }, 30000)

    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [loadDocuments])

  const summary = useMemo(() => summarize(documents, totalDocuments), [documents, totalDocuments])

  async function handleSyncAll() {
    setSyncing(true)
    setError(null)
    try {
      const syncResult = await syncDocumentStatuses()
      await loadDocuments({ clearError: false })
      if (syncResult.errors.length) {
        setError(syncResult.errors.join('；'))
      }
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSyncing(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    try {
      await loadDocuments()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setRefreshing(false)
    }
  }

  async function handleUpload(file: File, target: IndexTarget) {
    setUploading(true)
    setUploadError(null)
    try {
      await uploadDocument(file, target)
      setUploadOpen(false)
      await loadDocuments()
    } catch (caught) {
      setUploadError(errorMessage(caught))
      throw caught
    } finally {
      setUploading(false)
    }
  }

  async function handleSyncLightRAG(documentId: number) {
    setError(null)
    try {
      await syncLightRAGDocument(documentId)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      await loadDocuments({ clearError: false })
    }
  }

  async function handleSyncPageIndex(documentId: number) {
    setError(null)
    try {
      await syncPageIndexDocument(documentId)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      await loadDocuments({ clearError: false })
    }
  }

  async function handleDeleteDocument(document: DocumentRead) {
    const confirmed = window.confirm(
      `确定删除“${document.original_filename}”吗？这会删除 KGMS 记录，并尝试删除图谱服务中的同名文档记录。`,
    )
    if (!confirmed) {
      return
    }

    setDeletingDocumentId(document.id)
    setError(null)
    try {
      await deleteDocument(document.id)
      await loadDocuments({ clearError: false })
    } catch (caught) {
      setError(errorMessage(caught))
      await loadDocuments({ clearError: false })
    } finally {
      setDeletingDocumentId(null)
    }
  }

  function closeUploadDialog() {
    if (uploading) {
      return
    }
    setUploadOpen(false)
    setUploadError(null)
  }

  return (
    <div className="flex h-screen min-w-0 flex-col gap-4 overflow-hidden px-6 py-5">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">文档管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            上传文档，跟踪图谱构建与索引构建状态。
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={handleSyncAll}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            同步状态
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="h-4 w-4" />
            上传文档
          </button>
        </div>
      </header>

      <section className="grid grid-cols-4 gap-3">
        <SummaryCard label="文档总数" value={summary.total} testId="summary-total" />
        <SummaryCard label="图谱构建完成" value={summary.lightragCompleted} tone="green" />
        <SummaryCard label="索引构建完成" value={summary.pageindexSynced} tone="blue" />
        <SummaryCard label="异常任务" value={summary.failed} tone="amber" />
      </section>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <section className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <EmptyState title="正在加载文档" description="正在从 KGMS Backend 获取文档列表。" />
        ) : documents.length ? (
          <DocumentTable
            documents={documents}
            onSyncLightRAG={handleSyncLightRAG}
            onSyncPageIndex={handleSyncPageIndex}
            onDeleteDocument={handleDeleteDocument}
            deletingDocumentId={deletingDocumentId}
          />
        ) : (
          <EmptyState
            title="还没有文档"
            description="上传 PDF、Office 或图片文件后，可以开始图谱构建和索引构建。"
            action={
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                onClick={() => setUploadOpen(true)}
              >
                上传文档
              </button>
            }
          />
        )}
      </section>

      <UploadDialog
        open={uploadOpen}
        submitting={uploading}
        error={uploadError}
        onClose={closeUploadDialog}
        onUpload={handleUpload}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone = 'slate',
  testId,
}: {
  label: string
  value: number
  tone?: 'slate' | 'green' | 'blue' | 'amber'
  testId?: string
}) {
  const toneClass = {
    slate: 'text-slate-950',
    green: 'text-emerald-700',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
  }[tone]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${toneClass}`} data-testid={testId}>
        {value}
      </div>
    </div>
  )
}

function summarize(documents: DocumentRead[], total: number) {
  return {
    total,
    lightragCompleted: documents.filter((document) => document.lightrag_status === 'completed')
      .length,
    pageindexSynced: documents.filter((document) => document.pageindex_status === 'synced')
      .length,
    failed: documents.filter(
      (document) =>
        document.lightrag_status === 'failed' || document.pageindex_status === 'failed',
    ).length,
  }
}

function errorMessage(caught: unknown): string {
  if (caught instanceof Error) {
    return caught.message
  }
  return '操作失败'
}
