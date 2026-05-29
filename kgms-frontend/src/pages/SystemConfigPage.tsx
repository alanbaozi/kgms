import {
  Pencil,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  RotateCcw,
  X,
} from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { getSystemConfig, restartLightRAG, updateSystemConfig } from '../api/configuration'
import type { SecretRead, SystemConfigRead } from '../types/api'

type SystemForm = Record<string, string>

const KGMS_FIELDS = [
  { key: 'lightrag_base_url', label: 'LightRAG 服务地址' },
  { key: 'pageindex_base_url', label: 'PageIndex Base URL' },
  { key: 'pageindex_profile', label: 'PageIndex Profile' },
  { key: 'pageindex_timeout_seconds', label: 'PageIndex 超时秒数', type: 'number' },
  { key: 'default_top_k', label: '默认 Top K', type: 'number' },
] as const

const LIGHTRAG_LLM_FIELDS = [
  { key: 'llm_binding_host', label: 'LLM Base URL' },
  { key: 'llm_model', label: 'LLM 模型' },
  { key: 'query_llm_model', label: 'Query 模型' },
  { key: 'keyword_llm_model', label: 'Keyword 模型' },
] as const

const EMBEDDING_RERANK_FIELDS = [
  { key: 'embedding_binding_host', label: 'Embedding Base URL' },
  { key: 'embedding_model', label: 'Embedding 模型' },
  { key: 'embedding_dim', label: 'Embedding 维度', type: 'number' },
  { key: 'rerank_binding_host', label: 'Rerank Base URL' },
  { key: 'rerank_model', label: 'Rerank 模型' },
] as const

const MULTIMODAL_FIELDS = [
  { key: 'vlm_llm_binding_host', label: 'VLM Base URL' },
  { key: 'vlm_llm_model', label: 'VLM 模型' },
] as const

const SECRET_FIELDS = [
  { key: 'lightrag_api_key', label: 'LightRAG API Key', group: 'kgms' },
  { key: 'pageindex_api_key', label: 'PageIndex API Key', group: 'kgms' },
  { key: 'llm_binding_api_key', label: 'LLM API Key', group: 'lightrag' },
  { key: 'embedding_binding_api_key', label: 'Embedding API Key', group: 'lightrag' },
  { key: 'rerank_binding_api_key', label: 'Rerank API Key', group: 'lightrag' },
  { key: 'mineru_api_token', label: 'MinerU API Token', group: 'lightrag' },
  { key: 'vlm_llm_binding_api_key', label: 'VLM API Key', group: 'lightrag' },
] as const

export function SystemConfigPage() {
  const [config, setConfig] = useState<SystemConfigRead | null>(null)
  const [form, setForm] = useState<SystemForm>({})
  const [secrets, setSecrets] = useState<SystemForm>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restarting, setRestarting] = useState(false)
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
      const result = await getSystemConfig()
      setConfig(result)
      setForm(formFromConfig(result))
      setSecrets({})
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
      const result = await updateSystemConfig(buildUpdatePayload(form, secrets))
      setConfig(result)
      setForm(formFromConfig(result))
      setSecrets({})
      setEditing(false)
      setMessage(restartMessage(result))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  async function handleRestartLightRAG() {
    setRestarting(true)
    setError(null)
    setMessage(null)
    try {
      const result = await restartLightRAG()
      setMessage(result.output ? `图谱服务已重建：${result.output}` : '图谱服务已重建')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setRestarting(false)
    }
  }

  function updateField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateSecret(key: string, value: string) {
    setSecrets((current) => ({ ...current, [key]: value }))
  }

  function handleEdit() {
    setEditing(true)
    setMessage(null)
    setError(null)
  }

  function handleCancelEdit() {
    if (config) {
      setForm(formFromConfig(config))
    }
    setSecrets({})
    setEditing(false)
    setMessage(null)
    setError(null)
  }

  return (
    <div className="grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden px-6 py-5">
      <header className="flex items-start justify-between gap-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">系统配置</h1>
          <p className="mt-1 text-sm text-slate-500">
            管理 KGMS 与 LightRAG、PageIndex、MinerU 和模型服务的连接配置。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadConfig}
            disabled={loading || saving || restarting}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          {config?.deployment.restart_enabled ? (
            <button
              type="button"
              onClick={handleRestartLightRAG}
              disabled={loading || saving || restarting || editing}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              <RotateCcw className={`h-4 w-4 ${restarting ? 'animate-spin' : ''}`} />
              应用配置并重建图谱服务
            </button>
          ) : null}
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
              编辑系统配置
            </button>
          )}
        </div>
      </header>

      <main className="min-h-0 overflow-auto">
        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
            正在加载系统配置...
          </div>
        ) : config ? (
          <form className="space-y-4 pb-6" onSubmit={handleSubmit}>
            {error ? <Alert tone="red">{error}</Alert> : null}
            {message ? <Alert tone="amber">{message}</Alert> : null}

            <section className="rounded-lg border border-slate-200 bg-white">
              <SectionHeader icon={<Server className="h-4 w-4" />} title="服务连接" />
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                {KGMS_FIELDS.map((field) => (
                  <TextField
                    key={field.key}
                    label={field.label}
                    type={'type' in field ? field.type : undefined}
                    value={form[field.key] || ''}
                    disabled={!editing}
                    onChange={(value) => updateField(field.key, value)}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white">
              <SectionHeader icon={<SlidersHorizontal className="h-4 w-4" />} title="模型配置" />
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                {LIGHTRAG_LLM_FIELDS.map((field) => (
                  <TextField
                    key={field.key}
                    label={field.label}
                    value={form[field.key] || ''}
                    disabled={!editing}
                    onChange={(value) => updateField(field.key, value)}
                  />
                ))}
                {EMBEDDING_RERANK_FIELDS.map((field) => (
                  <TextField
                    key={field.key}
                    label={field.label}
                    type={'type' in field ? field.type : undefined}
                    value={form[field.key] || ''}
                    disabled={!editing}
                    onChange={(value) => updateField(field.key, value)}
                  />
                ))}
                {MULTIMODAL_FIELDS.map((field) => (
                  <TextField
                    key={field.key}
                    label={field.label}
                    value={form[field.key] || ''}
                    disabled={!editing}
                    onChange={(value) => updateField(field.key, value)}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white">
              <SectionHeader icon={<ShieldCheck className="h-4 w-4" />} title="密钥" />
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                {SECRET_FIELDS.map((field) => (
                  <SecretField
                    key={field.key}
                    label={field.label}
                    current={secretFor(config, field.group, field.key)}
                    editing={editing}
                    value={secrets[field.key] || ''}
                    onChange={(value) => updateSecret(field.key, value)}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">部署文件</div>
              <dl className="mt-3 grid gap-3 text-sm lg:grid-cols-2">
                <PathRow label="管理目录" value={config.deployment.managed_root} />
                <PathRow label="KGMS .env" value={config.deployment.kgms_env_path} />
                <PathRow label="LightRAG .env" value={config.deployment.lightrag_env_path} />
                <PathRow label="实体 Prompt" value={config.deployment.entity_prompt_path} />
                <PathRow label="问答 Prompt" value={config.deployment.qa_prompt_path} />
                <PathRow
                  label="自动应用"
                  value={config.deployment.restart_enabled ? '已启用' : '未启用'}
                />
                <PathRow label="重启策略" value={config.deployment.restart_strategy} />
                <PathRow
                  label="图谱服务容器"
                  value={config.deployment.lightrag_container_name}
                />
              </dl>
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
                  保存系统配置
                </button>
              </div>
            ) : null}
          </form>
        ) : null}
      </main>
    </div>
  )
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
      {icon}
      {title}
    </div>
  )
}

function TextField({
  label,
  value,
  type = 'text',
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  type?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed ${
          disabled
            ? 'border-slate-200 bg-slate-50 text-slate-600'
            : 'border-slate-300 bg-white text-slate-900'
        }`}
      />
    </label>
  )
}

function SecretField({
  label,
  current,
  editing,
  value,
  onChange,
}: {
  label: string
  current: SecretRead
  editing: boolean
  value: string
  onChange: (value: string) => void
}) {
  if (!editing) {
    return (
      <div className="block min-w-0 text-sm">
        <div className="font-medium text-slate-700">{label}</div>
        <div className="mt-1 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-600">
          {current.is_set ? current.masked : '未设置'}
        </div>
      </div>
    )
  }

  return (
    <label className="block min-w-0 text-sm">
      <span className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
          {current.is_set ? current.masked : '未设置'}
        </span>
      </span>
      <input
        aria-label={label}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="输入新密钥，留空保持不变"
        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  )
}

function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 truncate rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
        {value}
      </dd>
    </div>
  )
}

function Alert({ tone, children }: { tone: 'red' | 'amber'; children: ReactNode }) {
  const className =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-800'
  return <div className={`rounded-lg border px-4 py-3 text-sm ${className}`}>{children}</div>
}

function formFromConfig(config: SystemConfigRead): SystemForm {
  return {
    lightrag_base_url: config.kgms.lightrag_base_url,
    pageindex_base_url: config.kgms.pageindex_base_url,
    pageindex_profile: config.kgms.pageindex_profile,
    pageindex_timeout_seconds: String(config.kgms.pageindex_timeout_seconds),
    default_top_k: String(config.kgms.default_top_k),
    host: config.lightrag.host,
    port: String(config.lightrag.port),
    llm_binding_host: config.lightrag.llm_binding_host,
    llm_model: config.lightrag.llm_model,
    query_llm_model: config.lightrag.query_llm_model,
    keyword_llm_model: config.lightrag.keyword_llm_model,
    embedding_binding_host: config.lightrag.embedding_binding_host,
    embedding_model: config.lightrag.embedding_model,
    embedding_dim: String(config.lightrag.embedding_dim),
    rerank_binding_host: config.lightrag.rerank_binding_host,
    rerank_model: config.lightrag.rerank_model,
    vlm_llm_binding_host: config.lightrag.vlm_llm_binding_host,
    vlm_llm_model: config.lightrag.vlm_llm_model,
  }
}

function buildUpdatePayload(form: SystemForm, secrets: SystemForm) {
  const kgms = {
    lightrag_base_url: form.lightrag_base_url,
    pageindex_base_url: form.pageindex_base_url,
    pageindex_profile: form.pageindex_profile,
    pageindex_timeout_seconds: Number(form.pageindex_timeout_seconds || 180),
    default_top_k: Number(form.default_top_k || 10),
    ...secretPayload(secrets, ['lightrag_api_key', 'pageindex_api_key']),
  }
  const lightrag = {
    host: form.host,
    port: Number(form.port || 9621),
    llm_binding_host: form.llm_binding_host,
    llm_model: form.llm_model,
    query_llm_model: form.query_llm_model,
    keyword_llm_model: form.keyword_llm_model,
    embedding_binding_host: form.embedding_binding_host,
    embedding_model: form.embedding_model,
    embedding_dim: Number(form.embedding_dim || 1024),
    rerank_binding_host: form.rerank_binding_host,
    rerank_model: form.rerank_model,
    vlm_llm_binding_host: form.vlm_llm_binding_host,
    vlm_llm_model: form.vlm_llm_model,
    ...secretPayload(secrets, [
      'llm_binding_api_key',
      'embedding_binding_api_key',
      'rerank_binding_api_key',
      'mineru_api_token',
      'vlm_llm_binding_api_key',
    ]),
  }
  return { kgms, lightrag }
}

function secretPayload(secrets: SystemForm, keys: string[]) {
  return Object.fromEntries(
    keys
      .map((key) => [key, secrets[key]?.trim()] as const)
      .filter(([, value]) => Boolean(value)),
  )
}

function secretFor(config: SystemConfigRead, group: string, key: string): SecretRead {
  const source = group === 'kgms' ? config.kgms : config.lightrag
  return (source as unknown as Record<string, SecretRead>)[key] || { masked: '', is_set: false }
}

function restartMessage(config: SystemConfigRead): string {
  if (config.requires_kgms_restart && config.requires_lightrag_restart) {
    return '配置已保存。KGMS Backend 和 LightRAG 需要重启后完全生效。'
  }
  if (config.requires_lightrag_restart) {
    return '配置已保存。LightRAG 需要重启后完全生效。'
  }
  if (config.requires_kgms_restart) {
    return '配置已保存。KGMS Backend 需要重启后完全生效。'
  }
  return '配置已保存。'
}

function errorMessage(caught: unknown): string {
  if (caught instanceof Error) {
    return caught.message
  }
  return '操作失败'
}
