import pytest

from app.dependencies import get_lightrag_client, get_pageindex_client
from app.models import Document, PageIndexDocument, PageIndexTreeNode
from app.services.retrieval_orchestrator import graph_from_query_data


class FakeLightRAG:
    def __init__(
        self,
        *,
        answer: str = "LightRAG answer",
        references: list[dict] | None = None,
        query_data: dict | None = None,
        fail_query: bool = False,
        fail_query_data: bool = False,
    ) -> None:
        self.answer = answer
        self.references = references
        self.query_data_response = query_data or {
            "nodes": [
                {
                    "id": "entity-1",
                    "label": "无人机部队",
                    "entity_type": "force_unit",
                }
            ],
            "edges": [
                {
                    "source": "entity-1",
                    "target": "entity-2",
                    "label": "参与",
                }
            ],
        }
        self.fail_query = fail_query
        self.fail_query_data = fail_query_data
        self.query_calls: list[dict] = []
        self.query_data_calls: list[dict] = []

    async def query(
        self,
        query: str,
        mode: str = "mix",
        top_k: int | None = None,
    ) -> dict:
        self.query_calls.append({"query": query, "mode": mode, "top_k": top_k})
        if self.fail_query:
            raise RuntimeError("lightrag failed")
        if self.references is not None:
            return {"answer": self.answer, "references": self.references}
        return {
            "answer": self.answer,
            "sources": [{"kind": "lightrag", "id": "chunk-1"}],
        }

    async def query_data(
        self,
        query: str,
        mode: str = "mix",
        top_k: int | None = None,
    ) -> dict:
        self.query_data_calls.append({"query": query, "mode": mode, "top_k": top_k})
        if self.fail_query_data:
            raise RuntimeError("query_data failed")
        return self.query_data_response


class FakePageIndex:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.retrieve_calls: list[dict] = []

    async def retrieve(
        self,
        query: str,
        document_ids: list[str] | None = None,
        top_k: int = 10,
    ) -> dict:
        self.retrieve_calls.append(
            {"query": query, "document_ids": document_ids, "top_k": top_k}
        )
        if self.fail:
            raise RuntimeError("pageindex failed")
        return {"retrieval_id": "ret-1"}


def override_clients(client, *, lightrag=None, pageindex=None) -> None:
    if lightrag is not None:
        client.app.dependency_overrides[get_lightrag_client] = lambda: lightrag
    client.app.dependency_overrides[get_pageindex_client] = lambda: pageindex


def seed_pageindex_document(
    test_session_factory,
    *,
    filename: str = "report.pdf",
    title: str = "第二页 表格",
    text: str = "第2页表格原文证据：无人机从A阵地起飞。",
) -> Document:
    session = test_session_factory()
    try:
        document = Document(
            original_filename=filename,
            content_type="application/pdf",
            sha256="a" * 64,
            size_bytes=123,
            storage_path=f"uploads/{filename}",
        )
        document.pageindex_document = PageIndexDocument(
            pageindex_doc_id=f"remote-{filename}",
            remote_status="completed",
        )
        session.add(document)
        session.flush()
        session.add(
            PageIndexTreeNode(
                document_id=document.id,
                pageindex_document_id=document.pageindex_document.id,
                node_id="node-1",
                title=title,
                title_path=f"Root / {title}",
                page_index=2,
                text_excerpt=text,
            )
        )
        session.commit()
        return document
    finally:
        session.close()


def test_pageindex_mode_returns_pageindex_hit(client, test_session_factory) -> None:
    seed_pageindex_document(test_session_factory)
    lightrag = FakeLightRAG()
    pageindex = FakePageIndex()
    override_clients(client, lightrag=lightrag, pageindex=pageindex)

    response = client.post(
        "/api/retrieval/query",
        json={"query": "请给出第2页原文证据", "mode": "pageindex", "top_k": 3},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "pageindex"
    assert "原文证据" in data["answer"]
    assert data["pageindex_hits"][0]["title"] == "第二页 表格"
    assert data["pageindex_hits"][0]["page_index"] == 2
    assert "原文证据" in data["pageindex_hits"][0]["relevant_content"]
    assert lightrag.query_calls == []
    assert pageindex.retrieve_calls[0]["top_k"] == 3


def test_hybrid_mode_keeps_lightrag_answer_and_includes_pageindex_hits(
    client,
    test_session_factory,
) -> None:
    seed_pageindex_document(test_session_factory)
    lightrag = FakeLightRAG(answer="LightRAG mixed answer")
    pageindex = FakePageIndex()
    override_clients(client, lightrag=lightrag, pageindex=pageindex)

    response = client.post(
        "/api/retrieval/query",
        json={"query": "综合说明无人机证据", "mode": "hybrid", "top_k": 2},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "hybrid"
    assert data["answer"] == "LightRAG mixed answer"
    assert data["sources"] == [{"kind": "lightrag", "id": "chunk-1"}]
    assert len(data["pageindex_hits"]) == 1
    assert lightrag.query_calls == [
        {"query": "综合说明无人机证据", "mode": "mix", "top_k": 2}
    ]
    assert pageindex.retrieve_calls[0]["document_ids"] == ["remote-report.pdf"]


def test_lightrag_references_are_returned_as_sources(
    client,
    test_session_factory,
) -> None:
    seed_pageindex_document(test_session_factory)
    lightrag = FakeLightRAG(
        answer="LightRAG answer",
        references=[{"reference_id": "1", "file_path": "report.pdf"}],
    )
    pageindex = FakePageIndex()
    override_clients(client, lightrag=lightrag, pageindex=pageindex)

    response = client.post(
        "/api/retrieval/query",
        json={"query": "装备关系", "mode": "lightrag", "top_k": 2},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["sources"] == [{"reference_id": "1", "file_path": "report.pdf"}]


@pytest.mark.parametrize(
    "query",
    [
        "请找原文证据",
        "第几页提到无人机",
        "出处和引用在哪里",
        "表格和图片内容",
    ],
)
def test_smart_routes_evidence_page_source_table_image_questions_to_pageindex(
    client,
    test_session_factory,
    query: str,
) -> None:
    seed_pageindex_document(test_session_factory)
    lightrag = FakeLightRAG()
    pageindex = FakePageIndex()
    override_clients(client, lightrag=lightrag, pageindex=pageindex)

    response = client.post(
        "/api/retrieval/query",
        json={"query": query, "mode": "smart"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "pageindex"
    assert data["pageindex_hits"]
    assert "PageIndex" in data["route_reason"]
    assert lightrag.query_calls == []
    assert pageindex.retrieve_calls


@pytest.mark.parametrize(
    "query",
    [
        "装备之间有什么关系",
        "图谱中动作和事件是什么",
        "部队隶属关系和参与事件",
    ],
)
def test_smart_routes_graph_relation_equipment_action_event_questions_to_lightrag(
    client,
    test_session_factory,
    query: str,
) -> None:
    seed_pageindex_document(test_session_factory)
    lightrag = FakeLightRAG(answer="Graph answer")
    pageindex = FakePageIndex()
    override_clients(client, lightrag=lightrag, pageindex=pageindex)

    response = client.post(
        "/api/retrieval/query",
        json={"query": query, "mode": "smart"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "lightrag"
    assert data["answer"] == "Graph answer"
    assert data["graph"]["nodes"][0]["entity_type"] == "force_unit"
    assert data["graph"]["nodes"][0]["display_name"] == "部队/军事力量"
    assert "LightRAG" in data["route_reason"]
    assert lightrag.query_calls[0]["mode"] == "mix"
    assert pageindex.retrieve_calls == []


def test_hybrid_partial_pageindex_failure_records_diagnostics_and_returns_lightrag(
    client,
    test_session_factory,
) -> None:
    seed_pageindex_document(test_session_factory)
    lightrag = FakeLightRAG(answer="LightRAG survived")
    pageindex = FakePageIndex(fail=True)
    override_clients(client, lightrag=lightrag, pageindex=pageindex)

    response = client.post(
        "/api/retrieval/query",
        json={"query": "综合检索", "mode": "hybrid"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "hybrid"
    assert data["answer"] == "LightRAG survived"
    assert data["pageindex_hits"] == []
    assert data["diagnostics"]["lightrag_status"] == "ok"
    assert data["diagnostics"]["pageindex_status"] == "error"
    assert data["diagnostics"]["errors"] == ["PageIndex: pageindex failed"]


def test_hybrid_partial_lightrag_failure_records_diagnostics_and_returns_pageindex(
    client,
    test_session_factory,
) -> None:
    seed_pageindex_document(test_session_factory)
    lightrag = FakeLightRAG(fail_query=True)
    pageindex = FakePageIndex()
    override_clients(client, lightrag=lightrag, pageindex=pageindex)

    response = client.post(
        "/api/retrieval/query",
        json={"query": "综合检索", "mode": "hybrid"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "hybrid"
    assert data["answer"] == ""
    assert data["pageindex_hits"][0]["title"] == "第二页 表格"
    assert data["diagnostics"]["lightrag_status"] == "error"
    assert data["diagnostics"]["pageindex_status"] == "ok"
    assert data["diagnostics"]["errors"] == ["LightRAG: lightrag failed"]


def test_hybrid_missing_pageindex_client_records_diagnostics_and_returns_lightrag(
    client,
    test_session_factory,
) -> None:
    seed_pageindex_document(test_session_factory)
    lightrag = FakeLightRAG(answer="LightRAG fallback")
    override_clients(client, lightrag=lightrag, pageindex=None)

    response = client.post(
        "/api/retrieval/query",
        json={"query": "综合检索", "mode": "hybrid"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "hybrid"
    assert data["answer"] == "LightRAG fallback"
    assert data["pageindex_hits"] == []
    assert data["diagnostics"]["errors"] == ["PageIndex: client unavailable"]


def test_pageindex_mode_without_client_returns_empty_answer_and_diagnostics(
    client,
    test_session_factory,
) -> None:
    seed_pageindex_document(test_session_factory)
    lightrag = FakeLightRAG()
    override_clients(client, lightrag=lightrag, pageindex=None)

    response = client.post(
        "/api/retrieval/query",
        json={"query": "请给出原文证据", "mode": "pageindex"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "pageindex"
    assert data["answer"] == ""
    assert data["pageindex_hits"] == []
    assert data["diagnostics"]["lightrag_status"] == "skipped"
    assert data["diagnostics"]["pageindex_status"] == "error"
    assert data["diagnostics"]["errors"] == ["PageIndex: client unavailable"]


def test_graph_from_query_data_supports_lightrag_real_field_names() -> None:
    graph = graph_from_query_data(
        {
            "data": {
                "entities": [
                    {
                        "entity_name": "运油-20",
                        "entity_type": "equipment",
                        "description": "加油机",
                    }
                ],
                "relationships": [
                    {
                        "src_id": "运油-20",
                        "tgt_id": "歼-16",
                        "source_id": "chunk-1",
                        "keywords": "加油",
                    }
                ],
            }
        }
    )

    assert graph.nodes[0].id == "运油-20"
    assert graph.nodes[0].entity_type == "equipment"
    assert graph.edges[0].source == "运油-20"
    assert graph.edges[0].target == "歼-16"
    assert graph.edges[0].label == "加油"
