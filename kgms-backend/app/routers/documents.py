from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_session
from app.dependencies import (
    get_file_storage,
    get_lightrag_client,
    get_pageindex_client,
)
from app.domain import IndexTarget
from app.schemas import (
    DeleteDocumentResponse,
    DocumentListResponse,
    DocumentRead,
    DocumentStatusSyncResponse,
    UploadResponse,
)
from app.services import document_service
from app.services.file_storage import FileStorage


router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    index_target: IndexTarget = Form(IndexTarget.BOTH),
    session: Session = Depends(get_session),
    storage: FileStorage = Depends(get_file_storage),
    lightrag: Any = Depends(get_lightrag_client),
    pageindex: Any = Depends(get_pageindex_client),
) -> UploadResponse:
    document = await document_service.create_document(
        session=session,
        upload=file,
        index_target=index_target,
        storage=storage,
        lightrag=lightrag,
        pageindex=pageindex,
    )
    return UploadResponse(
        document=document_service.to_document_read(document),
        index_target=index_target,
    )


@router.get("", response_model=DocumentListResponse)
def list_documents(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
) -> DocumentListResponse:
    return document_service.list_documents(session, limit=limit, offset=offset)


@router.post("/sync-status", response_model=DocumentStatusSyncResponse)
async def sync_document_statuses(
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
    storage: FileStorage = Depends(get_file_storage),
    lightrag: Any = Depends(get_lightrag_client),
    pageindex: Any = Depends(get_pageindex_client),
) -> DocumentStatusSyncResponse:
    return await document_service.sync_document_statuses(
        session=session,
        storage=storage,
        lightrag=lightrag,
        pageindex=pageindex,
        limit=limit,
    )


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: int,
    session: Session = Depends(get_session),
) -> DocumentRead:
    document = document_service.get_document(session, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document_service.to_document_read(document)


@router.delete("/{document_id}", response_model=DeleteDocumentResponse)
async def delete_document(
    document_id: int,
    delete_remote: bool = Query(default=True),
    delete_remote_file: bool = Query(default=True),
    delete_llm_cache: bool = Query(default=False),
    session: Session = Depends(get_session),
    storage: FileStorage = Depends(get_file_storage),
    lightrag: Any = Depends(get_lightrag_client),
) -> DeleteDocumentResponse:
    try:
        result = await document_service.delete_document(
            session=session,
            document_id=document_id,
            storage=storage,
            lightrag=lightrag,
            delete_remote=delete_remote,
            delete_remote_file=delete_remote_file,
            delete_llm_cache=delete_llm_cache,
        )
    except document_service.DocumentDeletionBlocked as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return result


@router.post("/{document_id}/pageindex/sync", response_model=DocumentRead)
async def sync_pageindex(
    document_id: int,
    session: Session = Depends(get_session),
    storage: FileStorage = Depends(get_file_storage),
    pageindex: Any = Depends(get_pageindex_client),
) -> DocumentRead:
    try:
        document = await document_service.sync_pageindex(
            session=session,
            document_id=document_id,
            storage=storage,
            pageindex=pageindex,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document_service.to_document_read(document)


@router.post("/{document_id}/lightrag/sync", response_model=DocumentRead)
async def sync_lightrag(
    document_id: int,
    session: Session = Depends(get_session),
    lightrag: Any = Depends(get_lightrag_client),
) -> DocumentRead:
    try:
        document = await document_service.sync_lightrag_status(
            session=session,
            document_id=document_id,
            lightrag=lightrag,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document_service.to_document_read(document)
