import { Pencil, RefreshCw, Save, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

import { getDomainConfig, updateDomainConfig } from '../api/configuration'
import type { DomainConfigRead } from '../types/api'

export function DomainConfigPage() {
  const [config, setConfig] = useState<DomainConfigRead | null>(null)
  const [entityPrompt, setEntityPrompt] = useState('')
  const [qaPrompt, setQaPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadConfig()
  }, [])

  async function loadConfig() {
    setLoading(true)
    setError(null)
    try {
      const result = await getDomainConfig()
      setConfig(result)
      setEntityPrompt(result.entity_prompt_yaml)
      setQaPrompt(result.qa_prompt_markdown)
      setEditing(false)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) {
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const result = await updateDomainConfig({
        entity_prompt_yaml: entityPrompt,
        qa_prompt_markdown: qaPrompt,
      })
      setConfig(result)
      setEntityPrompt(result.entity_prompt_yaml)
      setQaPrompt(result.qa_prompt_markdown)
      setEditing(false)
      setMessage('领域配置已保存')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  function handleEdit() {
    setEditing(true)
    setMessage(null)
    setError(null)
  }

  function handleCancelEdit() {
    if (config) {
      setEntityPrompt(config.entity_prompt_yaml)
      setQaPrompt(config.qa_prompt_markdown)
    }
    setEditing(false)
    setMessage(null)
    setError(null)
  }

  return (
    <div className="grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden px-6 py-5">
      <header className="flex items-start justify-between gap-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">领域配置</h1>
          <p className="mt-1 text-sm text-slate-500">
            查看并维护 LightRAG 军事领域实体、关系、抽取 Prompt 和问答 Prompt。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadConfig}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          {editing ? (
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              取消编辑
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEdit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Pencil className="h-4 w-4" />
              编辑领域配置
            </button>
          )}
        </div>
      </header>

      <main className="min-h-0 overflow-auto">
        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
            正在加载领域配置...
          </div>
        ) : config ? (
          <form className="space-y-4 pb-6" onSubmit={handleSubmit}>
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-slate-900">实体类型</h2>
                <span className="text-xs text-slate-500">{config.entity_types.length} 类</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {config.entity_types.map((entity) => (
                  <div
                    key={entity.key}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: entity.color }}
                    />
                    <span className="truncate text-sm font-medium text-slate-800">
                      {entity.display_name}
                    </span>
                    <span className="ml-auto truncate font-mono text-xs text-slate-400">
                      {entity.key}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-slate-900">关系关键词</h2>
                <span className="text-xs text-slate-500">
                  {config.relation_keywords.length} 个
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {config.relation_keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </section>

            <section className="grid min-h-[520px] gap-4 xl:grid-cols-2">
              <PromptEditor
                label="抽取 Prompt"
                value={entityPrompt}
                readOnly={!editing}
                onChange={setEntityPrompt}
              />
              <PromptEditor
                label="问答 Prompt"
                value={qaPrompt}
                readOnly={!editing}
                onChange={setQaPrompt}
              />
            </section>

            {editing ? (
              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-kgms-canvas/95 py-3 backdrop-blur">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  保存领域配置
                </button>
              </div>
            ) : null}
          </form>
        ) : null}
      </main>
    </div>
  )
}

function PromptEditor({
  label,
  value,
  readOnly,
  onChange,
}: {
  label: string
  value: string
  readOnly: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
      <span className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
        {label}
      </span>
      <textarea
        aria-label={label}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className={`min-h-[460px] flex-1 resize-y rounded-b-lg border-0 p-4 font-mono text-xs leading-5 outline-none focus:ring-2 focus:ring-blue-200 ${
          readOnly ? 'bg-slate-950 text-slate-200' : 'bg-slate-950 text-slate-100'
        }`}
      />
    </label>
  )
}

function errorMessage(caught: unknown): string {
  if (caught instanceof Error) {
    return caught.message
  }
  return '操作失败'
}
