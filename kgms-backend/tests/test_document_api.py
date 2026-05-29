from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.dependencies import get_lightrag_client, get_pageindex_client
from app.domain import JobStatus
from app.models import Document, PageIndexDocument, PageIndexTreeNode


class FakeLightRAG:
    def __init__(self) -> None:
        self.uploads: list[tuple[str, str | None, str | None]] = []
        self.track_status_requests: list[str] = []
        self.paginated_requests: list[tuple[int, int]] = []
        self.delete_requests: list[tuple[list[str], bool, bool]] = []
        self.delete_status = "deletion_started"
        self.paginated_documents_response: dict | None = None

    async def upload_document(
        self,
        file_path: str | Path,
        filename: str | None = None,
        content_type: str | None = None,
    ) -> dict:
        self.uploads.append((str(file_path), filename, content_type))
        return {"track_id": "track-1", "document_id": "lightrag-doc-1"}

    async def track_status(self, track_id: str) -> dict:
        self.track_status_requests.append(track_id)
        return {
            "track_id": track_id,
            "documents": [
                {
                    "id": "doc-real-1",
                    "status": "parsing",
                    "error_msg": None,
                }
            ],
            "status_summary": {"parsing": 1},
        }

    async def paginated_documents(self, page: int = 1, page_size: int = 50) -> dict:
        self.paginated_requests.append((page, page_size))
        if self.paginated_documents_response is not None:
            return self.paginated_documents_response
        return {"documents": []}

    async def delete_documents(
        self,
        doc_ids: list[str],
        delete_file: bool = False,
        delete_llm_cache: bool = False,
    ) -> dict:
        self.delete_requests.append((doc_ids, delete_file, delete_llm_cache))
        return {
            "status": self.delete_status,
            "message": "delete scheduled",
            "doc_id": ", ".join(doc_ids),
        }


class FakePageIndex:
    def __init__(self) -> None:
        self.uploads: list[tuple[str, str | None, str | None]] = []
        self.document_requests: list[tuple[str, str | None]] = []

    async def upload_document(
        self,
        file_path: str | Path,
        filename: str | None = None,
        content_type: str | None = None,
    ) -> dict:
        self.uploads.append((str(file_path), filename, content_type))
        return {"doc_id": "pageindex-doc-1"}

    async def get_document(self, document_id: str, result_type: str | None = None) -> dict:
        self.document_requests.append((document_id, result_type))
        return {
            "result": {
                "tree": {
                    "id": "root",
                    "title": "Root",
                    "children": [
                        {
                            "id": "chapter-1",
                            "title": "第一章",
                            "page_index": 1,
                            "text": "PageIndex 同步章节",
                        }
                    ],
                }
            }
        }


def override_clients(
    client: TestClient,
    *,
    lightrag: FakeLightRAG | None = None,
    pageindex: FakePageIndex | None = None,
) -> tuple[FakeLightRAG, FakePageIndex | None]:
    lightrag_client = lightrag or FakeLightRAG()
    client.app.dependency_overrides[get_lightrag_client] = lambda: lightrag_client
    client.app.dependency_overrides[get_pageindex_client] = lambda: pageindex
    return lightrag_client, pageindex


def upload_document(
    client: TestClient,
    *,
    index_target: str,
    filename: str = "report.pdf",
) -> dict:
    response = client.post(
        "/api/documents/upload",
        data={"index_target": index_target},
        files={"file": (filename, b"test document", "application/pdf")},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_upload_list_get_and_sync_pageindex(
    client: TestClient,
    test_session_factory,
) -> None:
    pageindex = FakePageIndex()
    lightrag, _ = override_clients(client, pageindex=pageindex)

    upload_payload = upload_document(client, index_target="both")

    assert upload_payload["index_target"] == "both"
    document = upload_payload["document"]
    assert document["original_filename"] == "report.pdf"
    assert document["content_type"] == "application/pdf"
    assert document["size_bytes"] == len(b"test document")
    assert document["lightrag_status"] == JobStatus.UPLOADED.value
    assert document["lightrag_track_id"] == "track-1"
    assert document["lightrag_doc_id"] == "lightrag-doc-1"
    assert document["pageindex_status"] == JobStatus.UPLOADED.value
    assert document["pageindex_doc_id"] == "pageindex-doc-1"
    assert lightrag.uploads[0][1:] == ("report.pdf", "application/pdf")
    assert pageindex.uploads[0][1:] == ("report.pdf", "application/pdf")

    list_response = client.get("/api/documents")
    assert list_response.status_code == 200, list_response.text
    listed = list_response.json()
    assert listed["total"] == 1
    assert [item["id"] for item in listed["items"]] == [document["id"]]
    assert listed["items"][0]["pageindex_doc_id"] == "pageindex-doc-1"

    detail_response = client.get(f"/api/documents/{document['id']}")
    assert detail_response.status_code == 200, detail_response.text
    assert detail_response.json()["id"] == document["id"]
    assert detail_response.json()["pageindex_doc_id"] == "pageindex-doc-1"

    lightrag_sync_response = client.post(
        f"/api/documents/{document['id']}/lightrag/sync"
    )
    assert lightrag_sync_response.status_code == 200, lightrag_sync_response.text
    lightrag_synced = lightrag_sync_response.json()
    assert lightrag_synced["lightrag_status"] == "parsing"
    assert lightrag_synced["lightrag_doc_id"] == "doc-real-1"
    assert lightrag.track_status_requests == ["track-1"]

    sync_response = client.post(f"/api/documents/{document['id']}/pageindex/sync")
    assert sync_response.status_code == 200, sync_response.text
    synced = sync_response.json()
    assert synced["pageindex_status"] == JobStatus.SYNCED.value
    assert synced["pageindex_error"] is None
    assert synced["pageindex_doc_id"] == "pageindex-doc-1"
    assert pageindex.document_requests == [("pageindex-doc-1", "tree")]

    session = test_session_factory()
    try:
        pageindex_doc = session.scalar(
            select(PageIndexDocument).where(
                PageIndexDocument.document_id == document["id"]
            )
        )
        assert pageindex_doc is not None
        assert pageindex_doc.pageindex_doc_id == "pageindex-doc-1"

        nodes = session.scalars(
            select(PageIndexTreeNode)
            .where(PageIndexTreeNode.document_id == document["id"])
            .order_by(PageIndexTreeNode.id)
        ).all()
        assert [node.node_id for node in nodes] == ["root", "chapter-1"]
    finally:
        session.close()


def test_bulk_sync_status_updates_pending_lightrag_and_pageindex(
    client: TestClient,
) -> None:
    pageindex = FakePageIndex()
    lightrag, _ = override_clients(client, pageindex=pageindex)
    upload_payload = upload_document(client, index_target="both")
    document_id = upload_payload["document"]["id"]

    response = client.post("/api/documents/sync-status")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total"] == 1
    assert payload["lightrag_checked"] == 1
    assert payload["pageindex_checked"] == 1
    assert payload["errors"] == []
    synced = payload["items"][0]
    assert synced["id"] == document_id
    assert synced["lightrag_status"] == "parsing"
    assert synced["lightrag_doc_id"] == "doc-real-1"
    assert synced["pageindex_status"] == JobStatus.SYNCED.value
    assert synced["pageindex_error"] is None
    assert lightrag.track_status_requests == ["track-1"]
    assert pageindex.document_requests == [("pageindex-doc-1", "tree")]


def test_lightrag_sync_falls_back_to_paginated_documents_when_track_is_empty(
    client: TestClient,
) -> None:
    class EmptyTrackLightRAG(FakeLightRAG):
        async def track_status(self, track_id: str) -> dict:
            self.track_status_requests.append(track_id)
            return {"track_id": track_id, "documents": [], "total_count": 0}

    lightrag = EmptyTrackLightRAG()
    lightrag.paginated_documents_response = {
        "documents": [
            {
                "id": "lightrag-doc-1",
                "status": "analyzing",
                "track_id": "track-1",
                "error_msg": None,
                "file_path": "report.pdf",
            }
        ]
    }
    override_clients(client, lightrag=lightrag, pageindex=None)
    upload_payload = upload_document(client, index_target="lightrag")
    document_id = upload_payload["document"]["id"]

    response = client.post(f"/api/documents/{document_id}/lightrag/sync")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["lightrag_status"] == "analyzing"
    assert payload["lightrag_doc_id"] == "lightrag-doc-1"
    assert lightrag.track_status_requests == ["track-1"]
    assert lightrag.paginated_requests == [(1, 50)]


def test_lightrag_sync_uses_paginated_documents_when_track_id_is_missing(
    client: TestClient,
    test_session_factory,
) -> None:
    lightrag = FakeLightRAG()
    lightrag.paginated_documents_response = {
        "documents": [
            {
                "id": "doc-from-webui",
                "status": "processing",
                "track_id": "upload-from-webui",
                "error_msg": None,
                "file_path": "orphan.pdf",
            }
        ]
    }
    override_clients(client, lightrag=lightrag, pageindex=None)
    session = test_session_factory()
    try:
        document = Document(
            original_filename="orphan.pdf",
            content_type="application/pdf",
            sha256="a" * 64,
            size_bytes=10,
            storage_path="/tmp/orphan.pdf",
            lightrag_doc_id="doc-from-webui",
            lightrag_status=JobStatus.UNKNOWN.value,
            pageindex_status=JobStatus.SKIPPED.value,
        )
        session.add(document)
        session.commit()
        document_id = document.id
    finally:
        session.close()

    response = client.post(f"/api/documents/{document_id}/lightrag/sync")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["lightrag_status"] == "processing"
    assert payload["lightrag_track_id"] == "upload-from-webui"
    assert lightrag.track_status_requests == []
    assert lightrag.paginated_requests == [(1, 50)]


def test_lightrag_target_succeeds_without_pageindex_client(
    client: TestClient,
    test_session_factory,
) -> None:
    lightrag, pageindex = override_clients(client, pageindex=None)

    payload = upload_document(client, index_target="lightrag", filename="light.txt")

    document = payload["document"]
    assert document["lightrag_status"] == JobStatus.UPLOADED.value
    assert document["pageindex_status"] == JobStatus.SKIPPED.value
    assert document["pageindex_error"] is None
    assert document["pageindex_doc_id"] is None
    assert len(lightrag.uploads) == 1
    assert pageindex is None

    session = test_session_factory()
    try:
        stored = session.get(Document, document["id"])
        assert stored is not None
        assert stored.pageindex_document is None
    finally:
        session.close()


def test_delete_document_removes_local_records_files_and_remote_lightrag(
    client: TestClient,
    test_session_factory,
) -> None:
    pageindex = FakePageIndex()
    lightrag, _ = override_clients(client, pageindex=pageindex)
    upload_payload = upload_document(client, index_target="both")
    document = upload_payload["document"]

    sync_response = client.post(f"/api/documents/{document['id']}/pageindex/sync")
    assert sync_response.status_code == 200, sync_response.text
    storage_path = Path(document["storage_path"])
    assert storage_path.exists()

    response = client.delete(f"/api/documents/{document['id']}")

    assert response.status_code == 200, response.text
    assert response.json()["deleted"] is True
    assert response.json()["lightrag_delete_status"] == "deletion_started"
    assert lightrag.delete_requests == [(["lightrag-doc-1"], True, False)]
    assert not storage_path.exists()

    session = test_session_factory()
    try:
        assert session.get(Document, document["id"]) is None
        assert (
            session.scalar(
                select(PageIndexDocument).where(
                    PageIndexDocument.document_id == document["id"]
                )
            )
            is None
        )
        assert (
            session.scalar(
                select(PageIndexTreeNode).where(
                    PageIndexTreeNode.document_id == document["id"]
                )
            )
            is None
        )
    finally:
        session.close()


def test_delete_document_keeps_shared_upload_file_for_other_records(
    client: TestClient,
    test_session_factory,
) -> None:
    lightrag, _ = override_clients(client, pageindex=None)
    first = upload_document(client, index_target="lightrag")
    second = upload_document(client, index_target="lightrag")
    first_document = first["document"]
    second_document = second["document"]
    assert first_document["storage_path"] == second_document["storage_path"]
    storage_path = Path(first_document["storage_path"])
    assert storage_path.exists()

    response = client.delete(f"/api/documents/{first_document['id']}")

    assert response.status_code == 200, response.text
    assert storage_path.exists()
    assert lightrag.delete_requests == [(["lightrag-doc-1"], True, False)]
    session = test_session_factory()
    try:
        assert session.get(Document, first_document["id"]) is None
        assert session.get(Document, second_document["id"]) is not None
    finally:
        session.close()


def test_delete_document_keeps_record_when_lightrag_is_busy(
    client: TestClient,
    test_session_factory,
) -> None:
    lightrag = FakeLightRAG()
    lightrag.delete_status = "busy"
    override_clients(client, lightrag=lightrag, pageindex=None)
    upload_payload = upload_document(client, index_target="lightrag")
    document = upload_payload["document"]

    response = client.delete(f"/api/documents/{document['id']}")

    assert response.status_code == 409
    assert "LightRAG document deletion is busy" in response.text
    session = test_session_factory()
    try:
        assert session.get(Document, document["id"]) is not None
    finally:
        session.close()


def test_missing_document_returns_404(client: TestClient) -> None:
    override_clients(client, pageindex=FakePageIndex())

    response = client.get("/api/documents/999")

    assert response.status_code == 404
