export type IndexTarget = 'lightrag' | 'pageindex' | 'both'

export type JobStatus =
  | 'pending'
  | 'uploaded'
  | 'processing'
  | 'synced'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'unknown'
  | string

export type RetrievalMode = 'native' | 'lightrag' | 'pageindex' | 'hybrid' | 'smart'

export interface DocumentRead {
  id: number
  original_filename: string
  content_type: string | null
  sha256: string
  size_bytes: number
  storage_path: string
  lightrag_track_id: string | null
  lightrag_doc_id: string | null
  lightrag_status: JobStatus
  lightrag_error: string | null
  pageindex_doc_id: string | null
  pageindex_status: JobStatus
  pageindex_error: string | null
  created_at: string
  updated_at: string
}

export interface DocumentListResponse {
  items: DocumentRead[]
  total: number
}

export interface UploadResponse {
  document: DocumentRead
  index_target: IndexTarget
}

export interface DocumentStatusSyncResponse {
  items: DocumentRead[]
  total: number
  lightrag_checked: number
  pageindex_checked: number
  errors: string[]
}

export interface DeleteDocumentResponse {
  document_id: number
  deleted: boolean
  lightrag_delete_status: string | null
  deleted_paths?: string[]
  message: string
}

export interface PageIndexHitRead {
  id: number
  document_id: number | null
  query: string
  node_id: string | null
  title: string | null
  page_index: number | null
  relevant_content: string | null
  created_at: string
}

export interface GraphNode {
  id: string
  label: string
  entity_type: string
  display_name: string | null
  color: string | null
  properties: Record<string, unknown>
}

export interface GraphEdge {
  source: string
  target: string
  label: string
  properties: Record<string, unknown>
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface KnowledgeGraphRead {
  label: string
  max_depth: number
  max_nodes: number
  is_truncated: boolean
  node_count: number
  edge_count: number
  graph: GraphResponse
}

export interface GraphLabelsResponse {
  labels: string[]
  query: string | null
  limit: number
}

export interface RetrievalRequest {
  query: string
  mode: RetrievalMode
  top_k?: number
  filters?: Record<string, unknown>
  include_graph?: boolean
  include_pageindex_snippets?: boolean
}

export interface RetrievalDiagnostics {
  route_reason: string | null
  lightrag_status: string | null
  pageindex_status: string | null
  timings_ms: Record<string, number>
  errors: string[]
}

export interface RetrievalResponse {
  answer: string
  mode: RetrievalMode
  route_reason: string | null
  sources: Record<string, unknown>[]
  pageindex_hits: PageIndexHitRead[]
  graph: GraphResponse | null
  diagnostics: RetrievalDiagnostics
}

export interface SecretRead {
  masked: string
  is_set: boolean
}

export interface KgmsSystemConfigRead {
  lightrag_base_url: string
  lightrag_api_key: SecretRead
  pageindex_base_url: string
  pageindex_api_key: SecretRead
  pageindex_profile: string
  pageindex_timeout_seconds: number
  default_top_k: number
}

export interface LightRAGSystemConfigRead {
  host: string
  port: number
  llm_binding_host: string
  llm_binding_api_key: SecretRead
  llm_model: string
  query_llm_model: string
  keyword_llm_model: string
  embedding_binding_host: string
  embedding_binding_api_key: SecretRead
  embedding_model: string
  embedding_dim: number
  rerank_binding_host: string
  rerank_binding_api_key: SecretRead
  rerank_model: string
  mineru_api_token: SecretRead
  vlm_llm_binding_host: string
  vlm_llm_binding_api_key: SecretRead
  vlm_llm_model: string
}

export interface DeploymentConfigRead {
  managed_root: string
  kgms_env_path: string
  lightrag_env_path: string
  entity_prompt_path: string
  qa_prompt_path: string
  restart_enabled: boolean
  restart_strategy: string
  lightrag_container_name: string
}

export interface SystemConfigRead {
  kgms: KgmsSystemConfigRead
  lightrag: LightRAGSystemConfigRead
  deployment: DeploymentConfigRead
  requires_kgms_restart: boolean
  requires_lightrag_restart: boolean
}

export type KgmsSystemConfigUpdate = Partial<{
  lightrag_base_url: string
  lightrag_api_key: string
  pageindex_base_url: string
  pageindex_api_key: string
  pageindex_profile: string
  pageindex_timeout_seconds: number
  default_top_k: number
}>

export type LightRAGSystemConfigUpdate = Partial<{
  host: string
  port: number
  llm_binding_host: string
  llm_binding_api_key: string
  llm_model: string
  query_llm_model: string
  keyword_llm_model: string
  embedding_binding_host: string
  embedding_binding_api_key: string
  embedding_model: string
  embedding_dim: number
  rerank_binding_host: string
  rerank_binding_api_key: string
  rerank_model: string
  mineru_api_token: string
  vlm_llm_binding_host: string
  vlm_llm_binding_api_key: string
  vlm_llm_model: string
}>

export interface SystemConfigUpdate {
  kgms?: KgmsSystemConfigUpdate
  lightrag?: LightRAGSystemConfigUpdate
}

export interface RestartResponse {
  status: string
  output: string
}

export interface EntityTypeConfigRead {
  key: string
  display_name: string
  color: string
}

export interface DomainConfigRead {
  entity_types: EntityTypeConfigRead[]
  relation_keywords: string[]
  entity_prompt_yaml: string
  qa_prompt_markdown: string
}

export interface DomainConfigUpdate {
  entity_prompt_yaml: string
  qa_prompt_markdown: string
}
