import httpx
import pytest
import respx
from urllib.parse import parse_qs

from app.services.lightrag_client import LightRAGClient


@pytest.mark.asyncio
async def test_upload_document_posts_multipart_with_optional_api_key(tmp_path):
    file_path = tmp_path / "source.txt"
    file_path.write_text("kgms document", encoding="utf-8")

    with respx.mock(base_url="https://lightrag.test") as router:
        route = router.post("/documents/upload").mock(
            return_value=httpx.Response(200, json={"track_id": "track-1"})
        )

        async with LightRAGClient(
            "https://lightrag.test", api_key="light-key"
        ) as client:
            result = await client.upload_document(
                file_path,
                filename="report.txt",
                content_type="text/plain",
            )

    assert result == {"track_id": "track-1"}
    assert route.called
    request = route.calls.last.request
    assert request.headers["X-API-Key"] == "light-key"
    assert request.headers["Content-Type"].startswith("multipart/form-data")
    assert b'report.txt' in request.content
    assert b"kgms document" in request.content


@pytest.mark.asyncio
async def test_upload_document_error_includes_lightrag_detail(tmp_path):
    file_path = tmp_path / "source.txt"
    file_path.write_text("kgms document", encoding="utf-8")

    with respx.mock(base_url="https://lightrag.test") as router:
        router.post("/documents/upload").mock(
            return_value=httpx.Response(
                409,
                json={
                    "detail": (
                        "Document storage already contains 'source.txt' "
                        "(Status: failed). Delete the existing record before re-uploading."
                    )
                },
            )
        )

        async with LightRAGClient("https://lightrag.test") as client:
            with pytest.raises(httpx.HTTPStatusError) as excinfo:
                await client.upload_document(file_path)

    assert "Document storage already contains 'source.txt'" in str(excinfo.value)


@pytest.mark.asyncio
async def test_delete_documents_posts_lightrag_delete_payload():
    with respx.mock(base_url="https://lightrag.test") as router:
        route = router.delete("/documents/delete_document").mock(
            return_value=httpx.Response(
                200,
                json={
                    "status": "deletion_started",
                    "message": "Document deletion has been initiated.",
                    "doc_id": "doc-1",
                },
            )
        )

        async with LightRAGClient("https://lightrag.test") as client:
            result = await client.delete_documents(
                ["doc-1"],
                delete_file=True,
                delete_llm_cache=True,
            )

    assert result["status"] == "deletion_started"
    assert route.called
    assert route.calls.last.request.read() == (
        b'{"doc_ids":["doc-1"],"delete_file":true,"delete_llm_cache":true}'
    )


@pytest.mark.asyncio
async def test_track_status_gets_track_endpoint():
    with respx.mock(base_url="https://lightrag.test") as router:
        route = router.get("/documents/track_status/track-1").mock(
            return_value=httpx.Response(200, json={"status": "completed"})
        )

        async with LightRAGClient("https://lightrag.test") as client:
            result = await client.track_status("track-1")

    assert result == {"status": "completed"}
    assert route.called
    assert "X-API-Key" not in route.calls.last.request.headers


@pytest.mark.asyncio
async def test_paginated_documents_posts_light_webui_payload():
    with respx.mock(base_url="https://lightrag.test") as router:
        route = router.post("/documents/paginated").mock(
            return_value=httpx.Response(
                200,
                json={
                    "documents": [{"id": "doc-1", "status": "analyzing"}],
                    "pagination": {"total_count": 1},
                },
            )
        )

        async with LightRAGClient("https://lightrag.test") as client:
            result = await client.paginated_documents(page=2, page_size=20)

    assert result["documents"][0]["status"] == "analyzing"
    assert route.called
    assert route.calls.last.request.read() == (
        b'{"page":2,"page_size":20,"sort_field":"updated_at","sort_direction":"desc"}'
    )


@pytest.mark.asyncio
async def test_query_posts_query_payload():
    with respx.mock(base_url="https://lightrag.test") as router:
        route = router.post("/query").mock(
            return_value=httpx.Response(200, json={"answer": "matched"})
        )

        async with LightRAGClient("https://lightrag.test") as client:
            result = await client.query("态势", mode="mix", top_k=7)

    assert result == {"answer": "matched"}
    assert route.called
    assert route.calls.last.request.read() == b'{"query":"\xe6\x80\x81\xe5\x8a\xbf","mode":"mix","top_k":7}'


@pytest.mark.asyncio
async def test_query_data_posts_query_data_payload_without_null_top_k():
    with respx.mock(base_url="https://lightrag.test") as router:
        route = router.post("/query/data").mock(
            return_value=httpx.Response(200, json={"chunks": []})
        )

        async with LightRAGClient("https://lightrag.test") as client:
            result = await client.query_data("补给", mode="local")

    assert result == {"chunks": []}
    assert route.called
    assert route.calls.last.request.read() == b'{"query":"\xe8\xa1\xa5\xe7\xbb\x99","mode":"local"}'


@pytest.mark.asyncio
async def test_graph_gets_graphs_with_default_all_label_depth_and_limit():
    with respx.mock(base_url="https://lightrag.test") as router:
        route = router.get("/graphs").mock(
            return_value=httpx.Response(
                200,
                json={"nodes": [], "edges": [], "is_truncated": False},
            )
        )

        async with LightRAGClient("https://lightrag.test") as client:
            result = await client.graph()

    assert result == {"nodes": [], "edges": [], "is_truncated": False}
    assert route.called
    request = route.calls.last.request
    assert str(request.url).startswith("https://lightrag.test/graphs?")
    assert parse_qs(request.url.query.decode()) == {
        "label": ["*"],
        "max_depth": ["3"],
        "max_nodes": ["300"],
    }


@pytest.mark.asyncio
async def test_graph_gets_graphs_with_label_depth_and_limit():
    with respx.mock(base_url="https://lightrag.test") as router:
        route = router.get("/graphs").mock(
            return_value=httpx.Response(200, json={"nodes": [], "edges": []})
        )

        async with LightRAGClient("https://lightrag.test") as client:
            result = await client.graph(label="雷达", max_depth=2, max_nodes=25)

    assert result == {"nodes": [], "edges": []}
    assert route.called
    assert parse_qs(route.calls.last.request.url.query.decode()) == {
        "label": ["雷达"],
        "max_depth": ["2"],
        "max_nodes": ["25"],
    }


@pytest.mark.asyncio
async def test_popular_labels_gets_popular_label_endpoint():
    with respx.mock(base_url="https://lightrag.test") as router:
        route = router.get("/graph/label/popular").mock(
            return_value=httpx.Response(200, json=["09III型核潜艇", "雷达"])
        )

        async with LightRAGClient("https://lightrag.test") as client:
            result = await client.popular_labels(limit=20)

    assert result == ["09III型核潜艇", "雷达"]
    assert route.called
    assert parse_qs(route.calls.last.request.url.query.decode()) == {"limit": ["20"]}


@pytest.mark.asyncio
async def test_search_labels_gets_search_label_endpoint():
    with respx.mock(base_url="https://lightrag.test") as router:
        route = router.get("/graph/label/search").mock(
            return_value=httpx.Response(200, json=["相控阵雷达"])
        )

        async with LightRAGClient("https://lightrag.test") as client:
            result = await client.search_labels("雷达", limit=10)

    assert result == ["相控阵雷达"]
    assert route.called
    assert parse_qs(route.calls.last.request.url.query.decode()) == {
        "q": ["雷达"],
        "limit": ["10"],
    }
