import pytest

from app.config import Settings
from app.dependencies import get_lightrag_client, get_pageindex_client


@pytest.mark.asyncio
async def test_lightrag_dependency_uses_configured_timeout(tmp_path) -> None:
    settings = Settings(
        database_url="sqlite://",
        storage_root=tmp_path,
        lightrag_base_url="https://lightrag.test",
        lightrag_timeout_seconds=123,
    )

    dependency = get_lightrag_client(settings)
    client = await anext(dependency)
    try:
        assert client._client.timeout.read == 123
    finally:
        await dependency.aclose()


@pytest.mark.asyncio
async def test_pageindex_dependency_uses_configured_timeout(tmp_path) -> None:
    settings = Settings(
        database_url="sqlite://",
        storage_root=tmp_path,
        pageindex_base_url="https://pageindex.test",
        pageindex_api_key="pageindex-key",
        pageindex_timeout_seconds=234,
    )

    dependency = get_pageindex_client(settings)
    client = await anext(dependency)
    try:
        assert client is not None
        assert client._client.timeout.read == 234
    finally:
        await dependency.aclose()
