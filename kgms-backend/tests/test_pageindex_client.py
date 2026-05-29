import httpx
import pytest
import respx

from app.services.pageindex_client import PageIndexClient


def test_pageindex_client_requires_api_key():
    with pytest.raises(ValueError, match="api_key"):
        PageIndexClient("https://pageindex.test", api_key="")


def test_pageindex_client_rejects_non_ascii_placeholder_key():
    with pytest.raises(ValueError, match="real PageIndex API key"):
        PageIndexClient("https://pageindex.test", api_key="你的PageIndexKey")


@pytest.mark.asyncio
async def test_upload_document_posts_multipart_to_dev_v1_with_bearer_token(tmp_path):
    file_path = tmp_path / "source.pdf"
    file_path.write_bytes(b"%PDF-kgms")

    with respx.mock(base_url="https://api.pageindex.dev/v1") as router:
        route = router.post("/documents").mock(
            return_value=httpx.Response(200, json={"doc_id": "doc-1"})
        )

        async with PageIndexClient(
            "https://api.pageindex.dev/v1", api_key="test-key"
        ) as client:
            result = await client.upload_document(
                file_path,
                filename="report.pdf",
                content_type="application/pdf",
            )

    assert result == {"doc_id": "doc-1"}
    assert route.called
    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer test-key"
    assert request.headers["Content-Type"].startswith("multipart/form-data")
    assert b"report.pdf" in request.content
    assert b"%PDF-kgms" in request.content


@pytest.mark.asyncio
async def test_get_tree_uses_dev_v1_tree_endpoint_and_bearer_token():
    with respx.mock(base_url="https://api.pageindex.dev/v1") as router:
        route = router.get("/documents/doc-1/tree").mock(
            return_value=httpx.Response(200, json={"doc_id": "doc-1", "tree": []})
        )

        async with PageIndexClient(
            "https://api.pageindex.dev/v1", api_key="test-key"
        ) as client:
            result = await client.get_document("doc-1", result_type="tree")

    assert result == {"doc_id": "doc-1", "tree": []}
    assert route.called
    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer test-key"
    assert request.url == "https://api.pageindex.dev/v1/documents/doc-1/tree"


@pytest.mark.asyncio
async def test_retrieve_posts_query_and_first_document_id_with_api_key():
    with respx.mock(base_url="https://api.pageindex.dev/v1") as router:
        route = router.post("/retrieval").mock(
            return_value=httpx.Response(200, json={"retrieval_id": "ret-1"})
        )

        async with PageIndexClient(
            "https://api.pageindex.dev/v1", api_key="test-key"
        ) as client:
            result = await client.retrieve(
                "阵地",
                document_ids=["doc-1", "doc-2"],
                top_k=3,
            )

    assert result == {"retrieval_id": "ret-1"}
    assert route.called
    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer test-key"
    assert request.read() == (
        b'{"query":"\xe9\x98\xb5\xe5\x9c\xb0","thinking":false,"doc_id":"doc-1"}'
    )


@pytest.mark.asyncio
async def test_chat_posts_query_and_omits_null_document_ids():
    with respx.mock(base_url="https://api.pageindex.dev/v1") as router:
        route = router.post("/chat/completions").mock(
            return_value=httpx.Response(200, json={"answer": "ok"})
        )

        async with PageIndexClient(
            "https://api.pageindex.dev/v1", api_key="test-key"
        ) as client:
            result = await client.chat("总结", top_k=2)

    assert result == {"answer": "ok"}
    assert route.called
    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer test-key"
    assert request.read() == (
        b'{"messages":[{"role":"user","content":"\xe6\x80\xbb\xe7\xbb\x93"}],"stream":false,"top_k":2}'
    )


@pytest.mark.asyncio
async def test_official_ai_profile_still_supports_api_key_header(tmp_path):
    file_path = tmp_path / "source.pdf"
    file_path.write_bytes(b"%PDF-kgms")

    with respx.mock(base_url="https://api.pageindex.ai") as router:
        route = router.post("/doc/").mock(
            return_value=httpx.Response(200, json={"doc_id": "doc-ai"})
        )

        async with PageIndexClient(
            "https://api.pageindex.ai", api_key="test-key", profile="official"
        ) as client:
            result = await client.upload_document(file_path)

    assert result == {"doc_id": "doc-ai"}
    assert route.called
    assert route.calls.last.request.headers["api_key"] == "test-key"
