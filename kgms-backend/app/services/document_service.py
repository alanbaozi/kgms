import inspect
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.domain import IndexTarget, JobStatus
from app.models import Document, PageIndexDocument
from app.schemas import (
    DeleteDocumentResponse,
    DocumentListResponse,
    DocumentRead,
    DocumentStatusSyncResponse,
)
from app.services.file_storage import FileStorage
from app.services.pageindex_service import sync_pageindex_document


class DocumentDeletionBlocked(RuntimeError):
    pass


def to_document_read(document: Document) -> DocumentRead:
    data = DocumentRead.model_validate(document)
    if document.pageindex_document is not None:
        data.pageindex_doc_id = document.pageindex_document.pageindex_doc_id
    return data


async def create_document(
    session: Session,
    upload: UploadFile,
    index_target: IndexTarget | str,
    storage: FileStorage,
    lightrag: Any,
    pageindex: Any,
) -> Document:
    target = _normalize_index_target(index_target)
    filename = upload.filename or "upload.bin"
    sha256, size_bytes, storage_path = storage.save_upload(filename, upload.file)

    document = Document(
        original_filename=filename,
        content_type=upload.content_type,
        sha256=sha256,
        size_bytes=size_bytes,
        storage_path=str(storage_path),
    )
    session.add(document)
    session.commit()
    session.refresh(document)

    if target in (IndexTarget.LIGHTRAG, IndexTarget.BOTH):
        await _upload_lightrag(document, storage_path, lightrag)
    else:
        document.lightrag_status = JobStatus.SKIPPED.value
        document.lightrag_error = None

    if target in (IndexTarget.PAGEINDEX, IndexTarget.BOTH):
        await _upload_pageindex(session, document, storage_path, pageindex)
    else:
        document.pageindex_status = JobStatus.SKIPPED.value
        document.pageindex_error = None

    session.add(document)
    session.commit()
    session.refresh(document)
    return document


def list_documents(
    session: Session,
    limit: int = 50,
    offset: int = 0,
) -> DocumentListResponse:
    total = session.scalar(select(func.count()).select_from(Document)) or 0
    documents = session.scalars(
        select(Document)
        .order_by(Document.created_at.desc(), Document.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return DocumentListResponse(
        items=[to_document_read(document) for document in documents],
        total=total,
    )


def get_document(session: Session, document_id: int) -> Document | None:
    return session.get(Document, document_id)


async def delete_document(
    session: Session,
    document_id: int,
    storage: FileStorage,
    lightrag: Any,
    delete_remote: bool = True,
    delete_remote_file: bool = True,
    delete_llm_cache: bool = False,
) -> DeleteDocumentResponse | None:
    document = get_document(session, document_id)
    if document is None:
        return None

    remote_doc_id = document.lightrag_doc_id
    lightrag_delete_status: str | None = None
    if delete_remote and remote_doc_id:
        if lightrag is None:
            raise DocumentDeletionBlocked("LightRAG client is not configured")
        response = await _call_maybe_async(
            lightrag.delete_documents,
            [remote_doc_id],
            delete_file=delete_remote_file,
            delete_llm_cache=delete_llm_cache,
        )
        lightrag_delete_status = _first_string(response, ("status", "state")) or "unknown"
        if lightrag_delete_status in {"busy", "not_allowed"}:
            message = _first_string(response, ("message", "detail", "error"))
            detail = f": {message}" if message else ""
            raise DocumentDeletionBlocked(
                f"LightRAG document deletion is {lightrag_delete_status}{detail}"
            )

    other_file_references = (
        session.scalar(
            select(func.count())
            .select_from(Document)
            .where(
                Document.id != document.id,
                Document.storage_path == document.storage_path,
            )
        )
        or 0
    )
    deleted_paths = storage.delete_document_artifacts(
        document.storage_path,
        document.id,
        delete_upload_file=other_file_references == 0,
    )
    session.delete(document)
    session.commit()
    return DeleteDocumentResponse(
        document_id=document_id,
        deleted=True,
        lightrag_delete_status=lightrag_delete_status,
        deleted_paths=deleted_paths,
        message="文档已删除",
    )


async def sync_document_statuses(
    session: Session,
    storage: FileStorage,
    lightrag: Any,
    pageindex: Any,
    limit: int = 50,
) -> DocumentStatusSyncResponse:
    documents = list(
        session.scalars(
            select(Document)
            .where(
                or_(
                    Document.lightrag_status.in_(_LIGHTRAG_SYNCABLE_STATUSES),
                    Document.pageindex_status.in_(_PAGEINDEX_SYNCABLE_STATUSES),
                )
            )
            .order_by(Document.updated_at.asc(), Document.id.asc())
            .limit(limit)
        ).all()
    )

    lightrag_checked = 0
    pageindex_checked = 0
    errors: list[str] = []
    synced_documents: list[Document] = []

    for document in documents:
        if _should_sync_lightrag(document):
            if lightrag is None:
                errors.append(f"Document {document.id} LightRAG: client is not configured")
            else:
                lightrag_checked += 1
                try:
                    synced = await sync_lightrag_status(
                        session,
                        document.id,
                        lightrag,
                    )
                    if synced is not None:
                        document = synced
                except Exception as exc:  # noqa: BLE001 - status sync should continue.
                    document.lightrag_error = str(exc) or exc.__class__.__name__
                    session.add(document)
                    session.commit()
                    errors.append(f"Document {document.id} LightRAG: {document.lightrag_error}")

        if _should_sync_pageindex(document):
            if pageindex is None:
                errors.append(f"Document {document.id} PageIndex: client is not configured")
            elif document.pageindex_document is None:
                errors.append(f"Document {document.id} PageIndex: missing document id")
            else:
                pageindex_checked += 1
                try:
                    document = await sync_pageindex_document(
                        session,
                        document,
                        storage,
                        pageindex,
                    )
                except Exception as exc:  # noqa: BLE001 - not-ready states are per-document.
                    errors.append(f"Document {document.id} PageIndex: {exc}")
                    refreshed = session.get(Document, document.id)
                    if refreshed is not None:
                        document = refreshed

        synced_documents.append(document)

    return DocumentStatusSyncResponse(
        items=[to_document_read(document) for document in synced_documents],
        total=len(synced_documents),
        lightrag_checked=lightrag_checked,
        pageindex_checked=pageindex_checked,
        errors=errors,
    )


async def sync_pageindex(
    session: Session,
    document_id: int,
    storage: FileStorage,
    pageindex: Any,
) -> Document | None:
    document = get_document(session, document_id)
    if document is None:
        return None
    if pageindex is None:
        raise ValueError("PageIndex client is not configured")
    return await sync_pageindex_document(session, document, storage, pageindex)


async def sync_lightrag_status(
    session: Session,
    document_id: int,
    lightrag: Any,
) -> Document | None:
    document = get_document(session, document_id)
    if document is None:
        return None
    if lightrag is None:
        raise ValueError("LightRAG client is not configured")
    if not document.lightrag_track_id and not document.lightrag_doc_id:
        raise ValueError("Document does not have a LightRAG track id or document id")

    applied = False
    if document.lightrag_track_id:
        response = await _call_maybe_async(
            lightrag.track_status,
            document.lightrag_track_id,
        )
        applied = _apply_lightrag_track_status(document, response)

    if not applied or document.lightrag_status == JobStatus.UNKNOWN.value:
        remote_document = await _find_lightrag_document(lightrag, document)
        if remote_document is not None:
            _apply_lightrag_document_status(document, remote_document)

    session.add(document)
    session.commit()
    session.refresh(document)
    return document


async def _upload_lightrag(
    document: Document,
    storage_path: Path,
    lightrag: Any,
) -> None:
    if lightrag is None:
        document.lightrag_status = JobStatus.FAILED.value
        document.lightrag_error = "LightRAG client is not configured"
        return

    try:
        response = await _call_maybe_async(
            lightrag.upload_document,
            storage_path,
            filename=document.original_filename,
            content_type=document.content_type,
        )
    except Exception as exc:  # noqa: BLE001 - external client failures are recorded.
        document.lightrag_status = JobStatus.FAILED.value
        document.lightrag_error = str(exc) or exc.__class__.__name__
        return

    document.lightrag_track_id = _first_string(
        response,
        ("track_id", "id", "doc_id", "document_id"),
    )
    document.lightrag_doc_id = _first_string(
        response,
        ("doc_id", "document_id", "id", "track_id"),
    )
    document.lightrag_status = JobStatus.UPLOADED.value
    document.lightrag_error = None


async def _upload_pageindex(
    session: Session,
    document: Document,
    storage_path: Path,
    pageindex: Any,
) -> None:
    if pageindex is None:
        document.pageindex_status = JobStatus.FAILED.value
        document.pageindex_error = "PageIndex client is not configured"
        return

    try:
        response = await _call_maybe_async(
            pageindex.upload_document,
            storage_path,
            filename=document.original_filename,
            content_type=document.content_type,
        )
        pageindex_doc_id = _first_string(response, ("doc_id", "id", "document_id"))
        if pageindex_doc_id is None:
            raise ValueError("PageIndex upload response did not include a document id")
    except Exception as exc:  # noqa: BLE001 - external client failures are recorded.
        document.pageindex_status = JobStatus.FAILED.value
        document.pageindex_error = str(exc) or exc.__class__.__name__
        return

    pageindex_document = document.pageindex_document
    if pageindex_document is None:
        pageindex_document = PageIndexDocument(
            document_id=document.id,
            pageindex_doc_id=pageindex_doc_id,
        )
        session.add(pageindex_document)
    else:
        pageindex_document.pageindex_doc_id = pageindex_doc_id
    pageindex_document.remote_status = _first_string(
        response,
        ("status", "state"),
    ) or JobStatus.UPLOADED.value
    document.pageindex_status = JobStatus.UPLOADED.value
    document.pageindex_error = None


async def _call_maybe_async(func: Any, *args: Any, **kwargs: Any) -> Any:
    result = func(*args, **kwargs)
    if inspect.isawaitable(result):
        return await result
    return result


def _first_string(data: Any, keys: tuple[str, ...]) -> str | None:
    if not isinstance(data, dict):
        return None
    for key in keys:
        value = data.get(key)
        if value is None and isinstance(data.get("data"), dict):
            value = data["data"].get(key)
        if value is None and isinstance(data.get("result"), dict):
            value = data["result"].get(key)
        if value is not None and value != "":
            return str(value)
    return None


def _apply_lightrag_track_status(document: Document, response: Any) -> bool:
    if not isinstance(response, dict):
        document.lightrag_status = JobStatus.UNKNOWN.value
        return False

    documents = response.get("documents")
    first_document = documents[0] if isinstance(documents, list) and documents else {}
    if isinstance(first_document, dict):
        _apply_lightrag_document_status(document, first_document)
        return True

    document.lightrag_status = JobStatus.UNKNOWN.value
    return False


def _apply_lightrag_document_status(document: Document, remote_document: dict[str, Any]) -> None:
    remote_doc_id = _first_string(remote_document, ("id", "doc_id", "document_id"))
    if remote_doc_id:
        document.lightrag_doc_id = remote_doc_id
    remote_track_id = _first_string(remote_document, ("track_id", "trackId"))
    if remote_track_id:
        document.lightrag_track_id = remote_track_id
    remote_status = _first_string(remote_document, ("status", "state"))
    document.lightrag_status = _map_lightrag_status(remote_status)
    document.lightrag_error = _first_string(
        remote_document,
        ("error_msg", "error", "message"),
    )


async def _find_lightrag_document(lightrag: Any, document: Document) -> dict[str, Any] | None:
    if not hasattr(lightrag, "paginated_documents"):
        return None
    response = await _call_maybe_async(lightrag.paginated_documents, page=1, page_size=50)
    documents = response.get("documents") if isinstance(response, dict) else None
    if not isinstance(documents, list):
        return None

    for remote_document in documents:
        if not isinstance(remote_document, dict):
            continue
        if _matches_lightrag_document(document, remote_document):
            return remote_document
    return None


def _matches_lightrag_document(document: Document, remote_document: dict[str, Any]) -> bool:
    remote_doc_id = _first_string(remote_document, ("id", "doc_id", "document_id"))
    if document.lightrag_doc_id and remote_doc_id == document.lightrag_doc_id:
        return True

    remote_track_id = _first_string(remote_document, ("track_id", "trackId"))
    if document.lightrag_track_id and remote_track_id == document.lightrag_track_id:
        return True

    remote_file_path = _first_string(remote_document, ("file_path", "source_file_name"))
    if remote_file_path and Path(remote_file_path).name == document.original_filename:
        return True

    metadata = remote_document.get("metadata")
    if isinstance(metadata, dict):
        source_name = metadata.get("source_file_name")
        if isinstance(source_name, str) and Path(source_name).name == document.original_filename:
            return True

    return False


def _map_lightrag_status(status: str | None) -> str:
    if not status:
        return JobStatus.UNKNOWN.value
    normalized = status.strip().lower()
    if normalized in {"pending", "queued"}:
        return JobStatus.PENDING.value
    if normalized in {"parsing", "analyzing", "preprocessed"}:
        return normalized
    if normalized in {"processing", "running", "indexing"}:
        return JobStatus.PROCESSING.value
    if normalized in {"processed", "completed", "complete", "done", "success"}:
        return JobStatus.COMPLETED.value
    if normalized in {"failed", "failure", "error"}:
        return JobStatus.FAILED.value
    return normalized


def _normalize_index_target(index_target: IndexTarget | str) -> IndexTarget:
    if isinstance(index_target, IndexTarget):
        return index_target
    return IndexTarget(index_target)


_LIGHTRAG_SYNCABLE_STATUSES = {
    JobStatus.PENDING.value,
    JobStatus.UPLOADED.value,
    JobStatus.PROCESSING.value,
    JobStatus.UNKNOWN.value,
    "parsing",
    "analyzing",
    "preprocessed",
}
_PAGEINDEX_SYNCABLE_STATUSES = {
    JobStatus.PENDING.value,
    JobStatus.UPLOADED.value,
    JobStatus.PROCESSING.value,
    JobStatus.UNKNOWN.value,
}


def _should_sync_lightrag(document: Document) -> bool:
    return document.lightrag_status in _LIGHTRAG_SYNCABLE_STATUSES


def _should_sync_pageindex(document: Document) -> bool:
    return document.pageindex_status in _PAGEINDEX_SYNCABLE_STATUSES
