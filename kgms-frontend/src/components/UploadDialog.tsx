import { FileText, GitFork, Layers3, Upload, X } from 'lucide-react'
import { FormEvent, useState } from 'react'

import type { IndexTarget } from '../types/api'

interface UploadDialogProps {
  open: boolean
  submitting: boolean
  error: string | null
  onClose: () => void
  onUpload: (file: File, target: IndexTarget) => Promise<void>
}

const TARGET_OPTIONS: Array<{
  value: IndexTarget
  label: string
  description: string
  icon: typeof Layers3
}> = [
  {
    value: 'both',
    label: '混合构建',
    description: '同时提交图谱构建和索引构建',
    icon: Layers3,
  },
  {
    value: 'lightrag',
    label: '图谱构建',
    description: '提交给 LightRAG 构建知识图谱',
    icon: GitFork,
  },
  {
    value: 'pageindex',
    label: '索引构建',
    description: '提交给 PageIndex 构建文档索引',
    icon: FileText,
  },
]

export function UploadDialog({
  open,
  submitting,
  error,
  onClose,
  onUpload,
}: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [target, setTarget] = useState<IndexTarget>('both')

  if (!open) {
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      return
    }
    try {
      await onUpload(file, target)
      setFile(null)
      setTarget('both')
    } catch {
      // The parent owns the visible error state; keep the selected file for retry.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-dialog-title"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-workbench"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="upload-dialog-title" className="text-lg font-semibold text-slate-950">
              上传文档
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              文件会上传到 KGMS，并按构建目标提交给图谱构建和索引构建流程。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭上传窗口"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            title="关闭上传窗口"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:bg-slate-100">
          <Upload className="h-6 w-6 text-slate-400" />
          <span className="mt-2 text-sm font-medium text-slate-700">
            {file ? file.name : '选择 PDF、Office 或图片文件'}
          </span>
          <input
            className="sr-only"
            type="file"
            onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
          />
        </label>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-700">构建目标</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {TARGET_OPTIONS.map((option) => {
              const Icon = option.icon
              const active = option.value === target
              return (
                <label
                  key={option.value}
                  className={`flex min-h-[92px] cursor-pointer flex-col rounded-lg border p-3 transition ${
                    active
                      ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="index-target"
                    value={option.value}
                    checked={active}
                    onChange={() => setTarget(option.value)}
                  />
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </span>
                  <span
                    className={`mt-2 text-xs leading-5 ${
                      active ? 'text-blue-700' : 'text-slate-500'
                    }`}
                  >
                    {option.description}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!file || submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? '上传中...' : '开始上传'}
          </button>
        </div>
      </form>
    </div>
  )
}
