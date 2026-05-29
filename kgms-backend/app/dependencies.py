from collections.abc import AsyncGenerator

from fastapi import Depends

from app.config import Settings, get_settings
from app.services.file_storage import FileStorage
from app.services.lightrag_client import LightRAGClient
from app.services.pageindex_client import PageIndexClient


def get_file_storage(settings: Settings = Depends(get_settings)) -> FileStorage:
    return FileStorage(settings.storage_root)


async def get_lightrag_client(
    settings: Settings = Depends(get_settings),
) -> AsyncGenerator[LightRAGClient, None]:
    client = LightRAGClient(
        base_url=settings.lightrag_base_url,
        api_key=settings.lightrag_api_key or None,
        timeout=settings.lightrag_timeout_seconds,
    )
    try:
        yield client
    finally:
        await client.aclose()


async def get_pageindex_client(
    settings: Settings = Depends(get_settings),
) -> AsyncGenerator[PageIndexClient | None, None]:
    if not settings.pageindex_api_key.strip():
        yield None
        return

    client = PageIndexClient(
        base_url=settings.pageindex_base_url,
        api_key=settings.pageindex_api_key,
        timeout=settings.pageindex_timeout_seconds,
        profile=settings.pageindex_profile,
    )
    try:
        yield client
    finally:
        await client.aclose()
