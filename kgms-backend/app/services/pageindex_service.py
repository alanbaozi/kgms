import inspect
import json
import re
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.domain import JobStatus
from app.models import Document, PageIndexHit, PageIndexTreeNode
from app.services.file_storage import FileStorage


CHILDREN_KEYS = ("children", "nodes", "items")
NODE_ID_KEYS = ("node_id", "id")
TITLE_KEYS = ("title", "name", "heading")
PAGE_INDEX_KEYS = ("page_index", "page", "page_no")
TEXT_KEYS = ("text", "content", "summary", "markdown")
TEXT_EXCERPT_LIMIT = 2000


def flatten_tree_nodes(
    tree: dict[str, Any] | list[Any],
    parent_id: str | None = None,
    parent_path: list[str] | str | None = None,
) -> list[dict[str, Any]]:
    path_prefix = _normalize_parent_path(parent_path)
    rows: list[dict[str, Any]] = []
    generated_id = 0

    def next_generated_id() -> str:
        nonlocal generated_id
        generated_id += 1
        return f"node-{generated_id}"

    def walk(node: Any, current_parent_id: str | None, current_parent_path: list[str]) -> None:
        if not isinstance(node, dict):
            return

        node_id = _first_present(node, NODE_ID_KEYS)
        if node_id is None:
            node_id = next_generated_id()
        node_id = str(node_id)

        title = _first_present(node, TITLE_KEYS)
        if title is None:
            title = node_id
        title = str(title)

        page_index = _coerce_int(_first_present(node, PAGE_INDEX_KEYS))
        text_excerpt = _text_excerpt(_first_present(node, TEXT_KEYS))
        title_path_parts = [*current_parent_path, title]
        title_path = " / ".join(title_path_parts)

        rows.append(
            {
                "node_id": node_id,
                "parent_node_id": current_parent_id,
                "title": title,
                "title_path": title_path,
                "page_index": page_index,
                "text_excerpt": text_excerpt,
                "raw_json": node,
            }
        )

        for child in _children(node):
            walk(child, node_id, title_path_parts)

    for root in _as_node_list(tree):
        walk(root, parent_id, path_prefix)

    return rows


async def sync_pageindex_document(
    session: Session,
    document: Document,
    storage: FileStorage,
    pageindex: Any,
) -> Document:
    if document.pageindex_document is None:
        raise ValueError("document.pageindex_document is required")

    pageindex_doc = document.pageindex_document
    response = await _call_maybe_async(
        pageindex.get_document,
        pageindex_doc.pageindex_doc_id,
        result_type="tree",
    )
    if _is_processing_response(response):
        status = str(response.get("status") or JobStatus.PROCESSING.value)
        pageindex_doc.remote_status = status
        document.pageindex_status = JobStatus.PROCESSING.value
        document.pageindex_error = f"PageIndex document is not ready: {status}"
        session.commit()
        raise ValueError(document.pageindex_error)

    tree = _extract_tree(response)
    if not _looks_like_tree(tree):
        document.pageindex_status = JobStatus.PROCESSING.value
        document.pageindex_error = "PageIndex document tree is not ready"
        session.commit()
        raise ValueError(document.pageindex_error)

    tree_path = storage.write_json(
        storage.pageindex_dir(document.id) / "tree.json",
        tree,
    )

    session.execute(
        delete(PageIndexTreeNode).where(PageIndexTreeNode.document_id == document.id)
    )
    for row in flatten_tree_nodes(tree):
        session.add(
            PageIndexTreeNode(
                document_id=document.id,
                pageindex_document_id=pageindex_doc.id,
                node_id=row["node_id"],
                parent_node_id=row["parent_node_id"],
                title=row["title"],
                title_path=row["title_path"],
                page_index=row["page_index"],
                text_excerpt=row["text_excerpt"],
                raw_json=row["raw_json"],
            )
        )

    pageindex_doc.tree_path = str(Path(tree_path))
    document.pageindex_status = JobStatus.SYNCED.value
    document.pageindex_error = None
    session.commit()
    return document


def build_searchable_text(
    session: Session,
    documents: Iterable[Document],
) -> dict[int, str]:
    doc_ids = [document.id for document in documents if document.id is not None]
    searchable = {document_id: "" for document_id in doc_ids}
    if not doc_ids:
        return searchable

    rows = session.scalars(
        select(PageIndexTreeNode)
        .where(PageIndexTreeNode.document_id.in_(doc_ids))
        .order_by(PageIndexTreeNode.document_id, PageIndexTreeNode.id)
    ).all()

    parts_by_doc_id: dict[int, list[str]] = {document_id: [] for document_id in doc_ids}
    for row in rows:
        if row.document_id is None:
            continue
        parts = [
            row.title or "",
            row.title_path or "",
            row.text_excerpt or "",
        ]
        parts_by_doc_id.setdefault(row.document_id, []).extend(part for part in parts if part)

    return {
        document_id: "\n".join(parts)
        for document_id, parts in parts_by_doc_id.items()
    }


def select_candidate_doc_ids(
    query: str,
    documents: Iterable[Document],
    searchable_text_by_doc_id: dict[int, str],
    limit: int = 5,
) -> list[int]:
    if limit <= 0:
        return []

    query_text = _normalize_text(query)
    tokens = _query_tokens(query_text)
    query_chars = _chinese_chars(query_text)
    scored: list[tuple[int, int, int]] = []

    for order, document in enumerate(documents):
        if document.id is None:
            continue
        text = _normalize_text(searchable_text_by_doc_id.get(document.id, ""))
        score = _score_text(query_text, tokens, query_chars, text)
        scored.append((score, -order, document.id))

    scored.sort(reverse=True)
    return [document_id for _, _, document_id in scored[:limit]]


async def retrieve(
    session: Session,
    query: str,
    documents: Iterable[Document],
    pageindex: Any,
    top_k: int,
) -> list[PageIndexHit]:
    document_list = list(documents)
    if not document_list or top_k <= 0:
        return []

    candidate_limit = min(len(document_list), max(top_k, 5))
    searchable = build_searchable_text(session, document_list)
    candidate_doc_ids = select_candidate_doc_ids(
        query,
        document_list,
        searchable,
        limit=candidate_limit,
    )
    if not candidate_doc_ids:
        candidate_doc_ids = [
            document.id
            for document in document_list[:candidate_limit]
            if document.id is not None
        ]

    documents_by_id = {
        document.id: document for document in document_list if document.id is not None
    }
    remote_doc_ids = [
        documents_by_id[document_id].pageindex_document.pageindex_doc_id
        for document_id in candidate_doc_ids
        if document_id in documents_by_id
        and documents_by_id[document_id].pageindex_document is not None
    ]

    if pageindex is not None and remote_doc_ids:
        retrieval_response = await _call_maybe_async(
            pageindex.retrieve,
            query,
            remote_doc_ids,
            top_k=top_k,
        )
        remote_hits = await _remote_hits_from_retrieval(
            pageindex=pageindex,
            retrieval_response=retrieval_response,
            query=query,
            documents_by_id=documents_by_id,
            top_k=top_k,
        )
        if remote_hits:
            session.add_all(remote_hits)
            session.commit()
            return remote_hits
        chat_hit = await _chat_completion_hit(
            pageindex=pageindex,
            query=query,
            remote_doc_ids=remote_doc_ids,
            documents_by_id=documents_by_id,
            top_k=top_k,
        )
        if chat_hit is not None:
            session.add(chat_hit)
            session.commit()
            return [chat_hit]

    nodes = session.scalars(
        select(PageIndexTreeNode)
        .where(PageIndexTreeNode.document_id.in_(candidate_doc_ids))
        .order_by(PageIndexTreeNode.id)
    ).all()
    selected_nodes = _rank_nodes(query, nodes, candidate_doc_ids)[:top_k]

    hits = [
        PageIndexHit(
            document_id=node.document_id,
            query=query,
            node_id=node.node_id,
            title=node.title,
            page_index=node.page_index,
            relevant_content=node.text_excerpt or node.title_path,
        )
        for node in selected_nodes
    ]
    session.add_all(hits)
    session.commit()
    return hits


async def _remote_hits_from_retrieval(
    pageindex: Any,
    retrieval_response: Any,
    query: str,
    documents_by_id: dict[int, Document],
    top_k: int,
) -> list[PageIndexHit]:
    result = await _resolve_retrieval_result(pageindex, retrieval_response)
    nodes = _remote_retrieved_nodes(result)
    if not nodes:
        return []

    document_id_by_remote_id = {
        document.pageindex_document.pageindex_doc_id: document.id
        for document in documents_by_id.values()
        if document.id is not None and document.pageindex_document is not None
    }
    hits: list[PageIndexHit] = []
    for node in nodes[:top_k]:
        if not isinstance(node, dict):
            continue
        remote_doc_id = _first_present(
            node,
            ("doc_id", "document_id", "file_id", "source_doc_id"),
        )
        local_document_id = (
            document_id_by_remote_id.get(str(remote_doc_id))
            if remote_doc_id is not None
            else _first_local_document_id(documents_by_id)
        )
        hits.append(
            PageIndexHit(
                document_id=local_document_id,
                query=query,
                node_id=_string_or_none(
                    _first_present(node, ("node_id", "id", "chunk_id"))
                ),
                title=_string_or_none(_first_present(node, TITLE_KEYS)),
                page_index=_coerce_int(_first_present(node, PAGE_INDEX_KEYS)),
                relevant_content=_string_or_none(
                    _first_present(
                        node,
                        (
                            "relevant_content",
                            "text",
                            "content",
                            "summary",
                            "markdown",
                        ),
                    )
                ),
            )
        )
    return hits


async def _resolve_retrieval_result(pageindex: Any, retrieval_response: Any) -> Any:
    retrieval_id = _first_present(
        retrieval_response if isinstance(retrieval_response, dict) else {},
        ("retrieval_id", "id"),
    )
    if retrieval_id is None or not hasattr(pageindex, "get_retrieval"):
        return retrieval_response

    result = retrieval_response
    for _ in range(5):
        if _remote_retrieved_nodes(result):
            return result
        result = await _call_maybe_async(pageindex.get_retrieval, str(retrieval_id))
    return result


def _remote_retrieved_nodes(result: Any) -> list[Any]:
    if not isinstance(result, dict):
        return []
    for container in _dict_candidates(result):
        for key in (
            "retrieved_nodes",
            "nodes",
            "hits",
            "results",
            "items",
            "contexts",
        ):
            value = container.get(key)
            if isinstance(value, list):
                return value
    return []


async def _chat_completion_hit(
    pageindex: Any,
    query: str,
    remote_doc_ids: list[str],
    documents_by_id: dict[int, Document],
    top_k: int,
) -> PageIndexHit | None:
    if not hasattr(pageindex, "chat"):
        return None
    response = await _call_maybe_async(
        pageindex.chat,
        query,
        remote_doc_ids,
        top_k=top_k,
    )
    content = _chat_content(response)
    if not content:
        return None
    return PageIndexHit(
        document_id=_first_local_document_id(documents_by_id),
        query=query,
        node_id=None,
        title="PageIndex Answer",
        page_index=None,
        relevant_content=content,
    )


def _chat_content(response: Any) -> str | None:
    if isinstance(response, str):
        return response
    if not isinstance(response, dict):
        return None
    direct = _first_present(response, ("answer", "content", "response", "result"))
    if isinstance(direct, str):
        return direct

    choices = response.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str):
                    return content
            content = first.get("content")
            if isinstance(content, str):
                return content
    return None


def _first_present(data: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        value = data.get(key)
        if value is not None and value != "":
            return value
    return None


def _children(node: dict[str, Any]) -> list[Any]:
    for key in CHILDREN_KEYS:
        children = node.get(key)
        if children:
            return _as_node_list(children)
    return []


def _as_node_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, dict):
        return [value]
    return []


def _normalize_parent_path(parent_path: list[str] | str | None) -> list[str]:
    if parent_path is None:
        return []
    if isinstance(parent_path, list):
        return [str(part) for part in parent_path if str(part)]
    if str(parent_path):
        return [str(parent_path)]
    return []


def _coerce_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _text_excerpt(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value
    else:
        text = json.dumps(value, ensure_ascii=False)
    return text[:TEXT_EXCERPT_LIMIT]


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _first_local_document_id(documents_by_id: dict[int, Document]) -> int | None:
    for document_id in documents_by_id:
        return document_id
    return None


def _extract_tree(response: Any) -> Any:
    if not isinstance(response, dict):
        return response
    if "tree" in response:
        return response["tree"]
    for key in ("result", "data"):
        if key not in response:
            continue
        value = response[key]
        if isinstance(value, dict) and "tree" in value:
            return value["tree"]
        return value
    return response


def _dict_candidates(data: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = [data]
    for key in ("data", "result"):
        value = data.get(key)
        if isinstance(value, dict):
            candidates.append(value)
    return candidates


def _is_processing_response(response: Any) -> bool:
    if not isinstance(response, dict):
        return False
    if "tree" in response:
        return False
    if any(key in response for key in ("result", "data")):
        tree = _extract_tree(response)
        if _looks_like_tree(tree):
            return False
    if response.get("retrieval_ready") is False:
        return True
    status = str(response.get("status") or "").strip().lower()
    return status in {"pending", "processing", "parsing", "running"}


def _looks_like_tree(tree: Any) -> bool:
    if isinstance(tree, list):
        return bool(tree)
    if not isinstance(tree, dict):
        return False
    if any(key in tree for key in (*CHILDREN_KEYS, *TITLE_KEYS, *TEXT_KEYS)):
        return True
    if "tree" in tree or "result" in tree or "data" in tree:
        return True
    status = str(tree.get("status") or "").strip().lower()
    if status in {"pending", "processing", "parsing", "running"}:
        return False
    return len(tree) > 1


async def _call_maybe_async(func: Any, *args: Any, **kwargs: Any) -> Any:
    result = func(*args, **kwargs)
    if not inspect.isawaitable(result):
        return result
    return await result


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold()).strip()


def _query_tokens(query_text: str) -> list[str]:
    return [token for token in re.split(r"[\s,，。；;:：、]+", query_text) if token]


def _chinese_chars(value: str) -> set[str]:
    return {char for char in value if "\u4e00" <= char <= "\u9fff"}


def _score_text(
    query_text: str,
    tokens: list[str],
    query_chars: set[str],
    text: str,
) -> int:
    if not query_text:
        return 0

    score = 0
    if query_text and query_text in text:
        score += 100
    for token in tokens:
        if token in text:
            score += 20 + len(token)
    if query_chars:
        score += len(query_chars.intersection(_chinese_chars(text)))
    return score


def _rank_nodes(
    query: str,
    nodes: list[PageIndexTreeNode],
    candidate_doc_ids: list[int],
) -> list[PageIndexTreeNode]:
    query_text = _normalize_text(query)
    tokens = _query_tokens(query_text)
    query_chars = _chinese_chars(query_text)
    doc_order = {document_id: order for order, document_id in enumerate(candidate_doc_ids)}

    def sort_key(item: tuple[int, PageIndexTreeNode]) -> tuple[int, int, int]:
        index, node = item
        text = _normalize_text(
            "\n".join(
                part
                for part in (node.title or "", node.title_path or "", node.text_excerpt or "")
                if part
            )
        )
        score = _score_text(query_text, tokens, query_chars, text)
        return (
            score,
            -doc_order.get(node.document_id, len(doc_order)),
            -index,
        )

    return [node for _, node in sorted(enumerate(nodes), key=sort_key, reverse=True)]
