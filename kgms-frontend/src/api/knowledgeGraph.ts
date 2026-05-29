import { apiRequest } from './client'
import type { GraphLabelsResponse, KnowledgeGraphRead } from '../types/api'

export interface KnowledgeGraphQuery {
  label?: string
  max_depth?: number
  max_nodes?: number
}

export interface KnowledgeGraphLabelsQuery {
  query?: string
  limit?: number
}

export function getKnowledgeGraph(query: KnowledgeGraphQuery = {}): Promise<KnowledgeGraphRead> {
  const params = new URLSearchParams()
  params.set('label', query.label || '*')
  params.set('max_depth', String(query.max_depth || 3))
  params.set('max_nodes', String(query.max_nodes || 300))
  return apiRequest<KnowledgeGraphRead>(`/api/knowledge-graph?${params.toString()}`)
}

export function getKnowledgeGraphLabels(
  query: KnowledgeGraphLabelsQuery = {},
): Promise<GraphLabelsResponse> {
  const params = new URLSearchParams()
  if (query.query?.trim()) {
    params.set('query', query.query.trim())
  }
  params.set('limit', String(query.limit || 50))
  return apiRequest<GraphLabelsResponse>(`/api/knowledge-graph/labels?${params.toString()}`)
}
