from __future__ import annotations

from collections.abc import Iterable
from time import perf_counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain import RetrievalMode, normalize_entity_type
from app.models import Document, PageIndexDocument, PageIndexHit
from app.schemas import (
    GraphEdge,
    GraphNode,
    GraphResponse,
    PageIndexHitRead,
    RetrievalDiagnostics,
    RetrievalRequest,
    RetrievalResponse,
)
from app.services import pageindex_service


DEFAULT_TOP_K = 10

PAGEINDEX_QUERY_TERMS = (
    "原文",
    "第几页",
    "哪一页",
    "第几张",
    "证据",
    "出处",
    "引用",
    "表格",
    "图片",
    "截图",
    "页码",
    "片段",
    "snippet",
    "evidence",
    "source",
    "citation",
    "quote",
    "page",
    "table",
    "image",
)

LIGHTRAG_QUERY_TERMS = (
    "关系",
    "图谱",
    "装备",
    "动作",
    "事件",
    "隶属",
    "参与",
    "军事",
    "本体",
    "graph",
    "relation",
    "relationship",
    "equipment",
    "action",
    "event",
    "military",
    "ontology",
    "force",
    "unit",
)


def resolve_mode(request: RetrievalRequest) -> tuple[RetrievalMode, str]:
    if request.mode != RetrievalMode.SMART:
        return request.mode, f"Explicit retrieval mode: {request.mode.value}"

    query = request.query.casefold()
    if _contains_any(query, PAGEINDEX_QUERY_TERMS):
        return RetrievalMode.PAGEINDEX, "Smart route: PageIndex evidence/source query"
    if _contains_any(query, LIGHTRAG_QUERY_TERMS):
        return RetrievalMode.LIGHTRAG, "Smart route: LightRAG graph/ontology query"
    return RetrievalMode.HYBRID, "Smart route: uncertain query, using hybrid retrieval"


def documents_for_query(
    session: Session,
    document_ids: Iterable[int] | str | int | None,
) -> list[Document]:
    ids = _normalize_document_ids(document_ids)
    if ids:
        return list(
            session.scalars(
                select(Document)
                .where(Document.id.in_(ids))
                .order_by(Document.id)
            ).all()
        )

    documents_with_pageindex = list(
        session.scalars(
            select(Document)
            .join(PageIndexDocument)
            .order_by(Document.id)
        )
        .unique()
        .all()
    )
    if documents_with_pageindex:
        return documents_with_pageindex

    return list(session.scalars(select(Document).order_by(Document.id)).all())


def graph_from_query_data(data: Any) -> GraphResponse:
    if not isinstance(data, dict):
        return GraphResponse()

    nodes = [
        _graph_node_from_raw(node)
        for node in _first_list(data, ("nodes", "entities"))
        if isinstance(node, dict)
    ]
    edges = [
        edge
        for edge in (
            _graph_edge_from_raw(edge)
            for edge in _first_list(data, ("edges", "relationships"))
            if isinstance(edge, dict)
        )
        if edge is not None
    ]
    return GraphResponse(nodes=nodes, edges=edges)


async def run_query(
    session: Session,
    request: RetrievalRequest,
    lightrag: Any,
    pageindex: Any | None,
) -> RetrievalResponse:
    mode, route_reason = resolve_mode(request)
    top_k = request.top_k or DEFAULT_TOP_K
    diagnostics = RetrievalDiagnostics(route_reason=route_reason)
    answer = ""
    sources: list[dict[str, Any]] = []
    pageindex_hits: list[PageIndexHitRead] = []
    graph: GraphResponse | None = None

    needs_lightrag = mode in {
        RetrievalMode.NATIVE,
        RetrievalMode.LIGHTRAG,
        RetrievalMode.HYBRID,
    }
    needs_pageindex = mode in {
        RetrievalMode.PAGEINDEX,
        RetrievalMode.HYBRID,
    }

    if needs_lightrag:
        query_mode = "naive" if mode == RetrievalMode.NATIVE else "mix"
        started = perf_counter()
        try:
            lightrag_result = await lightrag.query(
                request.query,
                mode=query_mode,
                top_k=top_k,
            )
            diagnostics.lightrag_status = "ok"
            answer = _extract_answer(lightrag_result)
            sources = _extract_sources(lightrag_result)
        except Exception as exc:  # noqa: BLE001 - diagnostics should keep API successful.
            diagnostics.lightrag_status = "error"
            diagnostics.errors.append(f"LightRAG: {exc}")
        finally:
            diagnostics.timings_ms["lightrag"] = _elapsed_ms(started)

        if (
            diagnostics.lightrag_status == "ok"
            and request.include_graph
            and mode in {RetrievalMode.LIGHTRAG, RetrievalMode.HYBRID}
        ):
            graph_started = perf_counter()
            try:
                graph = graph_from_query_data(
                    await lightrag.query_data(
                        request.query,
                        mode=query_mode,
                        top_k=top_k,
                    )
                )
            except Exception as exc:  # noqa: BLE001
                diagnostics.errors.append(f"LightRAG query_data: {exc}")
            finally:
                diagnostics.timings_ms["lightrag_query_data"] = _elapsed_ms(
                    graph_started
                )
    else:
        diagnostics.lightrag_status = "skipped"

    if needs_pageindex:
        if pageindex is None:
            diagnostics.pageindex_status = "error"
            diagnostics.errors.append("PageIndex: client unavailable")
        else:
            started = perf_counter()
            try:
                document_ids = request.filters.get("document_ids")
                documents = documents_for_query(session, document_ids)
                hits = await pageindex_service.retrieve(
                    session,
                    request.query,
                    documents,
                    pageindex,
                    top_k,
                )
                diagnostics.pageindex_status = "ok"
                pageindex_hits = _serialize_pageindex_hits(hits)
                if (
                    mode == RetrievalMode.PAGEINDEX
                    and not answer
                    and pageindex_hits
                    and pageindex_hits[0].relevant_content
                ):
                    answer = pageindex_hits[0].relevant_content
            except Exception as exc:  # noqa: BLE001
                diagnostics.pageindex_status = "error"
                diagnostics.errors.append(f"PageIndex: {exc}")
            finally:
                diagnostics.timings_ms["pageindex"] = _elapsed_ms(started)
    else:
        diagnostics.pageindex_status = "skipped"

    return RetrievalResponse(
        answer=answer,
        mode=mode,
        route_reason=route_reason,
        sources=sources,
        pageindex_hits=pageindex_hits,
        graph=graph,
        diagnostics=diagnostics,
    )


def _contains_any(query: str, terms: Iterable[str]) -> bool:
    return any(term.casefold() in query for term in terms)


def _normalize_document_ids(document_ids: Iterable[int] | str | int | None) -> list[int]:
    if document_ids is None:
        return []
    if isinstance(document_ids, int):
        return [document_ids]
    if isinstance(document_ids, str):
        raw_values = document_ids.split(",")
    else:
        raw_values = list(document_ids)

    ids: list[int] = []
    for value in raw_values:
        try:
            ids.append(int(str(value).strip()))
        except (TypeError, ValueError):
            continue
    return ids


def _elapsed_ms(started: float) -> float:
    return round((perf_counter() - started) * 1000, 3)


def _extract_answer(data: Any) -> str:
    if isinstance(data, str):
        return data
    if not isinstance(data, dict):
        return ""

    for key in ("answer", "response", "result", "content"):
        value = data.get(key)
        if isinstance(value, str):
            return value
    return ""


def _extract_sources(data: Any) -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        return []
    for key in ("sources", "source", "references", "chunks", "contexts"):
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            return [value]
    return []


def _serialize_pageindex_hits(hits: Iterable[PageIndexHit]) -> list[PageIndexHitRead]:
    return [PageIndexHitRead.model_validate(hit) for hit in hits]


def _first_list(data: dict[str, Any], keys: tuple[str, ...]) -> list[Any]:
    for container in _dict_candidates(data):
        for key in keys:
            value = container.get(key)
            if isinstance(value, list):
                return value
    return []


def _dict_candidates(data: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = [data]
    for key in ("data", "result"):
        value = data.get(key)
        if isinstance(value, dict):
            candidates.append(value)
    return candidates


def _graph_node_from_raw(raw: dict[str, Any]) -> GraphNode:
    raw_id = _first_value(raw, ("id", "entity_id", "entity_name", "uid", "name", "label"))
    label = _node_label_from_raw(raw)
    node_id = str(raw_id or label or "node")
    node_label = str(label or node_id)
    entity_type = normalize_entity_type(
        _string_or_none(
            _first_value(raw, ("entity_type", "type", "category"))
            or _nested_value(raw, ("properties",), "entity_type")
        )
    )

    return GraphNode(
        id=node_id,
        label=node_label,
        entity_type=entity_type.key,
        display_name=entity_type.display_name,
        color=entity_type.color,
        properties={key: value for key, value in raw.items() if key not in {"id"}},
    )


def _graph_edge_from_raw(raw: dict[str, Any]) -> GraphEdge | None:
    source = _node_ref(
        _first_value(raw, ("source", "src_id", "from", "head", "src", "source_id"))
    )
    target = _node_ref(
        _first_value(raw, ("target", "target_id", "tgt_id", "to", "tail", "dst"))
    )
    if source is None or target is None:
        return None

    label = _first_value(
        raw,
        ("label", "relation", "relationship", "keywords", "name"),
    ) or _nested_value(raw, ("properties",), "keywords") or raw.get("type")
    return GraphEdge(
        source=source,
        target=target,
        label=str(label or "related"),
        properties=dict(raw),
    )


def _first_value(raw: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        value = raw.get(key)
        if value is not None and value != "":
            return value
    return None


def _node_label_from_raw(raw: dict[str, Any]) -> Any:
    label = _first_value(
        raw,
        ("label", "name", "title", "entity_name", "entity_id"),
    )
    if label is not None:
        return label
    labels = raw.get("labels")
    if isinstance(labels, list) and labels:
        return ", ".join(str(item) for item in labels)
    return _first_value(raw, ("id",))


def _nested_value(raw: dict[str, Any], path: tuple[str, ...], key: str) -> Any:
    current: Any = raw
    for part in path:
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    if not isinstance(current, dict):
        return None
    return current.get(key)


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _node_ref(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, dict):
        value = _first_value(value, ("id", "entity_id", "name", "label"))
    if value is None:
        return None
    return str(value)
