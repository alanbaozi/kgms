from typing import Any

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_lightrag_client
from app.schemas import GraphLabelsResponse, KnowledgeGraphRead
from app.services.lightrag_client import LightRAGClient
from app.services.retrieval_orchestrator import graph_from_query_data


router = APIRouter(prefix="/knowledge-graph", tags=["knowledge-graph"])


@router.get("", response_model=KnowledgeGraphRead)
async def get_knowledge_graph(
    label: str = Query(default="*", min_length=1),
    max_depth: int = Query(default=3, ge=1, le=10),
    max_nodes: int = Query(default=300, ge=1, le=5000),
    lightrag: LightRAGClient = Depends(get_lightrag_client),
) -> KnowledgeGraphRead:
    normalized_label = label.strip() or "*"
    raw_graph = await lightrag.graph(
        label=normalized_label,
        max_depth=max_depth,
        max_nodes=max_nodes,
    )
    graph = graph_from_query_data(raw_graph)
    return KnowledgeGraphRead(
        label=normalized_label,
        max_depth=max_depth,
        max_nodes=max_nodes,
        is_truncated=_is_truncated(raw_graph),
        node_count=len(graph.nodes),
        edge_count=len(graph.edges),
        graph=graph,
    )


@router.get("/labels", response_model=GraphLabelsResponse)
async def get_graph_labels(
    query: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=1000),
    lightrag: LightRAGClient = Depends(get_lightrag_client),
) -> GraphLabelsResponse:
    normalized_query = query.strip() if query else None
    if normalized_query:
        labels = await lightrag.search_labels(normalized_query, limit=limit)
    else:
        labels = await lightrag.popular_labels(limit=limit)
    return GraphLabelsResponse(
        labels=[label for label in labels if isinstance(label, str)],
        query=normalized_query,
        limit=limit,
    )


def _is_truncated(raw_graph: Any) -> bool:
    if isinstance(raw_graph, dict):
        return bool(raw_graph.get("is_truncated"))
    return False
