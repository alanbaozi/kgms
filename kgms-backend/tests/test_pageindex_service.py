import json

import pytest
from sqlalchemy import select

from app.domain import JobStatus
from app.models import Document, PageIndexDocument, PageIndexTreeNode
from app.services.file_storage import FileStorage
from app.services.pageindex_service import (
    flatten_tree_nodes,
    retrieve,
    select_candidate_doc_ids,
    sync_pageindex_document,
)


def make_document(filename: str, *, document_id: int | None = None) -> Document:
    return Document(
        id=document_id,
        original_filename=filename,
        content_type="application/pdf",
        sha256="a" * 64,
        size_bytes=123,
        storage_path=f"uploads/{filename}",
    )


def nested_tree() -> dict:
    return {
        "id": "root",
        "name": "Root",
        "page": 1,
        "summary": "总览",
        "children": [
            {
                "node_id": "chapter-1",
                "title": "第一章",
                "page_index": 2,
                "text": "第一章介绍无人机部署计划",
                "nodes": [
                    {
                        "id": "section-1",
                        "heading": "态势",
                        "page_no": 3,
                        "content": "阵地态势和保障节点",
                    }
                ],
            }
        ],
    }


def test_flatten_tree_nodes_preserves_nested_paths_and_fields() -> None:
    nodes = flatten_tree_nodes(nested_tree())

    assert nodes[0]["node_id"] == "root"
    assert nodes[0]["parent_node_id"] is None
    assert nodes[0]["title"] == "Root"
    assert nodes[0]["title_path"] == "Root"
    assert nodes[0]["page_index"] == 1
    assert nodes[0]["text_excerpt"] == "总览"

    assert nodes[1]["node_id"] == "chapter-1"
    assert nodes[1]["parent_node_id"] == "root"
    assert nodes[1]["title"] == "第一章"
    assert nodes[1]["title_path"] == "Root / 第一章"
    assert nodes[1]["page_index"] == 2
    assert nodes[1]["text_excerpt"] == "第一章介绍无人机部署计划"

    assert nodes[2]["node_id"] == "section-1"
    assert nodes[2]["parent_node_id"] == "chapter-1"
    assert nodes[2]["title_path"] == "Root / 第一章 / 态势"
    assert nodes[2]["page_index"] == 3


def test_select_candidate_doc_ids_prefers_documents_with_matching_tree_text() -> None:
    documents = [
        make_document("logistics.pdf", document_id=1),
        make_document("uav-plan.pdf", document_id=2),
        make_document("weather.pdf", document_id=3),
    ]
    searchable_text = {
        1: "后勤保障和补给路线",
        2: "第一章 无人机部署计划 阵地侦察",
        3: "天气海况摘要",
    }

    assert select_candidate_doc_ids("无人机 阵地", documents, searchable_text, limit=2) == [
        2,
        1,
    ]


class FakePageIndex:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str | None]] = []

    def get_document(self, document_id: str, result_type: str | None = None) -> dict:
        self.calls.append((document_id, result_type))
        return {"result": {"tree": nested_tree()}}


class ProcessingPageIndex:
    def get_document(self, document_id: str, result_type: str | None = None) -> dict:
        return {
            "doc_id": document_id,
            "status": "processing",
            "retrieval_ready": False,
            "metadata": {},
        }


class OfficialTreePageIndex:
    def get_document(self, document_id: str, result_type: str | None = None) -> dict:
        return {
            "doc_id": document_id,
            "status": "completed",
            "retrieval_ready": False,
            "result": [
                {
                    "title": "建造",
                    "node_id": "0000",
                    "page_index": 1,
                },
                {
                    "title": "武器",
                    "node_id": "0001",
                    "page_index": 4,
                },
            ],
            "metadata": {},
        }


class RetrievalPageIndex:
    def __init__(self) -> None:
        self.retrieve_calls: list[tuple[str, list[str] | None, int]] = []
        self.result_calls: list[str] = []

    async def retrieve(
        self,
        query: str,
        document_ids: list[str] | None = None,
        top_k: int = 10,
    ) -> dict:
        self.retrieve_calls.append((query, document_ids, top_k))
        return {"retrieval_id": "ret-1", "status": "processing"}

    async def get_retrieval(self, retrieval_id: str) -> dict:
        self.result_calls.append(retrieval_id)
        return {
            "status": "completed",
            "retrieved_nodes": [
                {
                    "doc_id": "remote-doc-1",
                    "node_id": "node-a",
                    "title": "技术参数",
                    "page_index": 2,
                    "relevant_content": "最大潜航深度为300至400米。",
                }
            ],
        }


class ChatFallbackPageIndex:
    async def retrieve(
        self,
        query: str,
        document_ids: list[str] | None = None,
        top_k: int = 10,
    ) -> dict:
        return {"retrieval_id": "ret-empty"}

    async def get_retrieval(self, retrieval_id: str) -> dict:
        return {"status": "completed", "retrieved_nodes": []}

    async def chat(
        self,
        query: str,
        document_ids: list[str] | None = None,
        top_k: int = 10,
    ) -> dict:
        return {
            "choices": [
                {
                    "message": {
                        "content": "第1页：09III型核潜艇是攻击型核潜艇。"
                    }
                }
            ]
        }


async def test_sync_pageindex_document_writes_tree_and_replaces_nodes(
    tmp_path,
    test_session_factory,
) -> None:
    session = test_session_factory()
    try:
        document = make_document("report.pdf")
        document.pageindex_status = JobStatus.PROCESSING.value
        document.pageindex_error = "old error"
        document.pageindex_document = PageIndexDocument(pageindex_doc_id="remote-doc-1")
        session.add(document)
        session.flush()

        old_node = PageIndexTreeNode(
            document_id=document.id,
            pageindex_document_id=document.pageindex_document.id,
            node_id="old-node",
            title="旧节点",
        )
        session.add(old_node)
        session.commit()

        storage = FileStorage(tmp_path)
        pageindex = FakePageIndex()

        result = await sync_pageindex_document(session, document, storage, pageindex)

        assert result.id == document.id
        assert pageindex.calls == [("remote-doc-1", "tree")]
        assert document.pageindex_status == JobStatus.SYNCED.value
        assert document.pageindex_error is None

        tree_path = storage.pageindex_dir(document.id) / "tree.json"
        assert document.pageindex_document.tree_path == str(tree_path)
        assert json.loads(tree_path.read_text(encoding="utf-8")) == nested_tree()

        rows = session.scalars(
            select(PageIndexTreeNode)
            .where(PageIndexTreeNode.document_id == document.id)
            .order_by(PageIndexTreeNode.id)
        ).all()
        assert [row.node_id for row in rows] == ["root", "chapter-1", "section-1"]
        assert [row.title_path for row in rows] == [
            "Root",
            "Root / 第一章",
            "Root / 第一章 / 态势",
        ]
        assert all(row.pageindex_document_id == document.pageindex_document.id for row in rows)
    finally:
        session.close()


async def test_sync_pageindex_document_accepts_official_completed_result_tree(
    tmp_path,
    test_session_factory,
) -> None:
    session = test_session_factory()
    try:
        document = make_document("report.pdf")
        document.pageindex_document = PageIndexDocument(pageindex_doc_id="remote-doc-1")
        session.add(document)
        session.commit()

        await sync_pageindex_document(
            session,
            document,
            FileStorage(tmp_path),
            OfficialTreePageIndex(),
        )

        assert document.pageindex_status == JobStatus.SYNCED.value
        assert document.pageindex_error is None
        rows = session.scalars(
            select(PageIndexTreeNode)
            .where(PageIndexTreeNode.document_id == document.id)
            .order_by(PageIndexTreeNode.id)
        ).all()
        assert [row.node_id for row in rows] == ["0000", "0001"]
        assert [row.title for row in rows] == ["建造", "武器"]
    finally:
        session.close()


async def test_sync_pageindex_document_marks_processing_when_tree_not_ready(
    tmp_path,
    test_session_factory,
) -> None:
    session = test_session_factory()
    try:
        document = make_document("report.pdf")
        document.pageindex_document = PageIndexDocument(pageindex_doc_id="remote-doc-1")
        session.add(document)
        session.commit()

        with pytest.raises(ValueError, match="not ready"):
            await sync_pageindex_document(
                session,
                document,
                FileStorage(tmp_path),
                ProcessingPageIndex(),
            )

        assert document.pageindex_status == JobStatus.PROCESSING.value
        assert "processing" in document.pageindex_error
        rows = session.scalars(
            select(PageIndexTreeNode).where(PageIndexTreeNode.document_id == document.id)
        ).all()
        assert rows == []
    finally:
        session.close()


async def test_retrieve_uses_remote_pageindex_hits_when_available(
    test_session_factory,
) -> None:
    session = test_session_factory()
    try:
        document = make_document("report.pdf")
        document.pageindex_document = PageIndexDocument(pageindex_doc_id="remote-doc-1")
        session.add(document)
        session.commit()

        pageindex = RetrievalPageIndex()
        hits = await retrieve(
            session=session,
            query="潜航深度",
            documents=[document],
            pageindex=pageindex,
            top_k=5,
        )

        assert pageindex.retrieve_calls == [("潜航深度", ["remote-doc-1"], 5)]
        assert pageindex.result_calls == ["ret-1"]
        assert len(hits) == 1
        assert hits[0].document_id == document.id
        assert hits[0].node_id == "node-a"
        assert hits[0].title == "技术参数"
        assert hits[0].page_index == 2
        assert hits[0].relevant_content == "最大潜航深度为300至400米。"
    finally:
        session.close()


async def test_retrieve_falls_back_to_pageindex_chat_completion(
    test_session_factory,
) -> None:
    session = test_session_factory()
    try:
        document = make_document("report.pdf")
        document.pageindex_document = PageIndexDocument(pageindex_doc_id="remote-doc-1")
        session.add(document)
        session.commit()

        hits = await retrieve(
            session=session,
            query="原文证据",
            documents=[document],
            pageindex=ChatFallbackPageIndex(),
            top_k=5,
        )

        assert len(hits) == 1
        assert hits[0].document_id == document.id
        assert hits[0].title == "PageIndex Answer"
        assert hits[0].relevant_content == "第1页：09III型核潜艇是攻击型核潜艇。"
    finally:
        session.close()
