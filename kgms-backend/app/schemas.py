from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.domain import IndexTarget, RetrievalMode


class DocumentRead(BaseModel):
    id: int
    original_filename: str
    content_type: Optional[str] = None
    sha256: str
    size_bytes: int
    storage_path: str
    lightrag_track_id: Optional[str] = None
    lightrag_doc_id: Optional[str] = None
    lightrag_status: str
    lightrag_error: Optional[str] = None
    pageindex_doc_id: Optional[str] = None
    pageindex_status: str
    pageindex_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentListResponse(BaseModel):
    items: List[DocumentRead]
    total: int


class UploadResponse(BaseModel):
    document: DocumentRead
    index_target: IndexTarget = IndexTarget.BOTH


class DocumentStatusSyncResponse(BaseModel):
    items: List[DocumentRead]
    total: int
    lightrag_checked: int = 0
    pageindex_checked: int = 0
    errors: List[str] = Field(default_factory=list)


class DeleteDocumentResponse(BaseModel):
    document_id: int
    deleted: bool = True
    lightrag_delete_status: Optional[str] = None
    deleted_paths: List[str] = Field(default_factory=list)
    message: str = "文档已删除"


class PageIndexHitRead(BaseModel):
    id: int
    document_id: Optional[int] = None
    query: str
    node_id: Optional[str] = None
    title: Optional[str] = None
    page_index: Optional[int] = None
    relevant_content: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GraphNode(BaseModel):
    id: str
    label: str
    entity_type: str = "other"
    display_name: Optional[str] = None
    color: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str
    properties: Dict[str, Any] = Field(default_factory=dict)


class GraphResponse(BaseModel):
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)


class KnowledgeGraphRead(BaseModel):
    label: str = "*"
    max_depth: int = 3
    max_nodes: int = 300
    is_truncated: bool = False
    node_count: int = 0
    edge_count: int = 0
    graph: GraphResponse = Field(default_factory=GraphResponse)


class GraphLabelsResponse(BaseModel):
    labels: List[str] = Field(default_factory=list)
    query: Optional[str] = None
    limit: int = 50


class RetrievalRequest(BaseModel):
    query: str = Field(min_length=1)
    mode: RetrievalMode = RetrievalMode.SMART
    top_k: Optional[int] = Field(default=None, ge=1)
    filters: Dict[str, Any] = Field(default_factory=dict)
    include_graph: bool = True
    include_pageindex_snippets: bool = True


class RetrievalDiagnostics(BaseModel):
    route_reason: Optional[str] = None
    lightrag_status: Optional[str] = None
    pageindex_status: Optional[str] = None
    timings_ms: Dict[str, float] = Field(default_factory=dict)
    errors: List[str] = Field(default_factory=list)


class RetrievalResponse(BaseModel):
    answer: str = ""
    mode: RetrievalMode
    route_reason: Optional[str] = None
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    pageindex_hits: List[PageIndexHitRead] = Field(default_factory=list)
    graph: Optional[GraphResponse] = None
    diagnostics: RetrievalDiagnostics = Field(default_factory=RetrievalDiagnostics)


class SecretRead(BaseModel):
    masked: str = ""
    is_set: bool = False


class KgmsSystemConfigRead(BaseModel):
    lightrag_base_url: str = ""
    lightrag_api_key: SecretRead = Field(default_factory=SecretRead)
    pageindex_base_url: str = ""
    pageindex_api_key: SecretRead = Field(default_factory=SecretRead)
    pageindex_profile: str = ""
    pageindex_timeout_seconds: float = 180.0
    default_top_k: int = 10


class LightRAGSystemConfigRead(BaseModel):
    host: str = ""
    port: int = 9621
    llm_binding_host: str = ""
    llm_binding_api_key: SecretRead = Field(default_factory=SecretRead)
    llm_model: str = ""
    query_llm_model: str = ""
    keyword_llm_model: str = ""
    embedding_binding_host: str = ""
    embedding_binding_api_key: SecretRead = Field(default_factory=SecretRead)
    embedding_model: str = ""
    embedding_dim: int = 0
    rerank_binding_host: str = ""
    rerank_binding_api_key: SecretRead = Field(default_factory=SecretRead)
    rerank_model: str = ""
    mineru_api_token: SecretRead = Field(default_factory=SecretRead)
    vlm_llm_binding_host: str = ""
    vlm_llm_binding_api_key: SecretRead = Field(default_factory=SecretRead)
    vlm_llm_model: str = ""


class DeploymentConfigRead(BaseModel):
    managed_root: str
    kgms_env_path: str
    lightrag_env_path: str
    entity_prompt_path: str
    qa_prompt_path: str
    restart_enabled: bool = False
    restart_strategy: str = "compose"
    lightrag_container_name: str = "kgms-lightrag"


class SystemConfigRead(BaseModel):
    kgms: KgmsSystemConfigRead
    lightrag: LightRAGSystemConfigRead
    deployment: DeploymentConfigRead
    requires_kgms_restart: bool = False
    requires_lightrag_restart: bool = False


class KgmsSystemConfigUpdate(BaseModel):
    lightrag_base_url: Optional[str] = None
    lightrag_api_key: Optional[str] = None
    pageindex_base_url: Optional[str] = None
    pageindex_api_key: Optional[str] = None
    pageindex_profile: Optional[str] = None
    pageindex_timeout_seconds: Optional[float] = Field(default=None, ge=1)
    default_top_k: Optional[int] = Field(default=None, ge=1)


class LightRAGSystemConfigUpdate(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    llm_binding_host: Optional[str] = None
    llm_binding_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    query_llm_model: Optional[str] = None
    keyword_llm_model: Optional[str] = None
    embedding_binding_host: Optional[str] = None
    embedding_binding_api_key: Optional[str] = None
    embedding_model: Optional[str] = None
    embedding_dim: Optional[int] = Field(default=None, ge=1)
    rerank_binding_host: Optional[str] = None
    rerank_binding_api_key: Optional[str] = None
    rerank_model: Optional[str] = None
    mineru_api_token: Optional[str] = None
    vlm_llm_binding_host: Optional[str] = None
    vlm_llm_binding_api_key: Optional[str] = None
    vlm_llm_model: Optional[str] = None


class SystemConfigUpdate(BaseModel):
    kgms: Optional[KgmsSystemConfigUpdate] = None
    lightrag: Optional[LightRAGSystemConfigUpdate] = None


class EntityTypeConfigRead(BaseModel):
    key: str
    display_name: str
    color: str


class DomainConfigRead(BaseModel):
    entity_types: List[EntityTypeConfigRead]
    relation_keywords: List[str] = Field(default_factory=list)
    entity_prompt_yaml: str = ""
    qa_prompt_markdown: str = ""


class DomainConfigUpdate(BaseModel):
    entity_prompt_yaml: str
    qa_prompt_markdown: str


class RestartResponse(BaseModel):
    status: str
    output: str = ""
