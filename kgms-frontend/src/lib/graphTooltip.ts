type TooltipData = {
  name?: unknown
  categoryLabel?: unknown
  label?: unknown
  value?: unknown
  properties?: unknown
}

const SOURCE_KEYS = [
  'file_path',
  'filepath',
  'source_file_name',
  'sourcefilename',
  'source_file',
  'sourcefile',
  'source_id',
  'sourceid',
  'source_ids',
  'sourceids',
  'doc_id',
  'docid',
  'document_id',
  'documentid',
  'source',
  'resource',
  'resources',
]
const RELATION_SOURCE_KEYS = [
  'file_path',
  'filepath',
  'source_file_name',
  'sourcefilename',
  'source_file',
  'sourcefile',
  'source_id',
  'sourceid',
  'source_ids',
  'sourceids',
  'doc_id',
  'docid',
  'document_id',
  'documentid',
  'resource',
  'resources',
]
const DESCRIPTION_KEYS = [
  'description',
  'desc',
  'summary',
  'content',
  'entity_description',
  'entitydescription',
  '说明',
  '描述',
]
const RELATION_NAME_KEYS = [
  'keywords',
  'label',
  'relation',
  'relationship',
  'relation_name',
  'relationship_name',
  'name',
  '关系',
  '名称',
]
const RELATION_TYPE_KEYS = [
  'relation_type',
  'relationship_type',
  'edge_type',
  'type',
  'category',
  '关系类型',
  '类型',
]

export interface GraphTooltipParams {
  dataType: string
  data: TooltipData
}

export function formatGraphTooltip(params: GraphTooltipParams): string {
  if (params.dataType === 'edge') {
    return formatEdgeTooltip(params.data)
  }

  return formatNodeTooltip(params.data)
}

function formatNodeTooltip(data: TooltipData): string {
  const properties = normalizeProperties(data.properties)
  const name = String(data.name || '')
  const type = String(data.categoryLabel || propertyString(properties, 'entity_type') || '其他')
  const description = firstPropertyString(properties, DESCRIPTION_KEYS) || '暂无描述'
  const source = firstPropertyString(properties, SOURCE_KEYS) || '暂无来源'

  return [
    `<strong>${escapeHtml(name)}</strong>`,
    tooltipRow('名称', name),
    tooltipRow('类型', type),
    tooltipBlock('描述', description),
    tooltipBlock('来源', source),
  ].join('')
}

function formatEdgeTooltip(data: TooltipData): string {
  const properties = normalizeProperties(data.properties)
  const name =
    stringValue(data.label) ||
    stringValue(data.name) ||
    stringValue(data.value) ||
    firstPropertyString(properties, RELATION_NAME_KEYS) ||
    '关联'
  const type = formatRelationType(firstPropertyString(properties, RELATION_TYPE_KEYS))
  const description = firstPropertyString(properties, DESCRIPTION_KEYS) || '暂无描述'
  const source = firstPropertyString(properties, RELATION_SOURCE_KEYS) || '暂无来源'

  return [
    `<strong>${escapeHtml(name)}</strong>`,
    tooltipRow('名称', name),
    tooltipRow('类型', type),
    tooltipBlock('描述', description),
    tooltipBlock('来源', source),
  ].join('')
}

function tooltipRow(label: string, value: string): string {
  return `<div><span class="kgms-tooltip-label">${escapeHtml(label)}：</span>${escapeHtml(value)}</div>`
}

function tooltipBlock(label: string, value: string): string {
  return [
    '<div class="kgms-tooltip-block">',
    `<div class="kgms-tooltip-label">${escapeHtml(label)}：</div>`,
    `<div class="kgms-tooltip-value">${escapeHtml(value)}</div>`,
    '</div>',
  ].join('')
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function normalizeProperties(properties: unknown): Record<string, unknown> | null {
  const outer = toRecord(properties)
  if (!outer) {
    return null
  }

  const nested = propertyRecord(outer, 'properties')
  if (!nested) {
    return outer
  }

  return {
    ...outer,
    ...nested,
  }
}

function firstPropertyString(
  properties: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!properties) {
    return null
  }

  for (const key of keys) {
    const value = propertyString(properties, key)
    if (value) {
      return value
    }
  }

  return null
}

function propertyString(properties: Record<string, unknown> | null, targetKey: string): string | null {
  if (!properties) {
    return null
  }

  const normalizedTarget = normalizeKey(targetKey)
  const entry = Object.entries(properties).find(([key]) => normalizeKey(key) === normalizedTarget)
  if (!entry) {
    return null
  }

  const formatted = formatPropertyValue(entry[1])
  return formatted.trim() || null
}

function propertyRecord(
  properties: Record<string, unknown> | null,
  targetKey: string,
): Record<string, unknown> | null {
  if (!properties) {
    return null
  }

  const normalizedTarget = normalizeKey(targetKey)
  const entry = Object.entries(properties).find(([key]) => normalizeKey(key) === normalizedTarget)
  if (!entry) {
    return null
  }

  return toRecord(entry[1])
}

function formatRelationType(type: string | null): string {
  if (!type) {
    return '关系'
  }

  const normalized = normalizeKey(type)
  if (normalized === 'directed') {
    return '有向关系'
  }
  if (normalized === 'undirected') {
    return '无向关系'
  }
  return type
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '')
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return null
  }
  const formatted = String(value).trim()
  return formatted || null
}

function formatPropertyValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
