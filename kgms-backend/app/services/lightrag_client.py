from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx


class LightRAGClient:
    ENDPOINTS = {
        "upload_document": "/documents/upload",
        "delete_documents": "/documents/delete_document",
        "paginated_documents": "/documents/paginated",
        "track_status": "/documents/track_status/{track_id}",
        "query": "/query",
        "query_data": "/query/data",
        "graph": "/graphs",
        "popular_labels": "/graph/label/popular",
        "search_labels": "/graph/label/search",
    }

    def __init__(
        self,
        base_url: str,
        api_key: str | None = None,
        timeout: float = 60.0,
    ) -> None:
        headers = {"X-API-Key": api_key} if api_key else None
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers=headers,
            timeout=timeout,
        )

    async def __aenter__(self) -> "LightRAGClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def upload_document(
        self,
        file_path: str | Path,
        filename: str | None = None,
        content_type: str | None = None,
    ) -> dict[str, Any]:
        path = Path(file_path)
        upload_filename = filename or path.name
        file_tuple: tuple[str, Any] | tuple[str, Any, str]
        with path.open("rb") as file:
            if content_type:
                file_tuple = (upload_filename, file, content_type)
            else:
                file_tuple = (upload_filename, file)
            response = await self._client.post(
                self.ENDPOINTS["upload_document"],
                files={"file": file_tuple},
            )
        self._raise_for_status(response)
        return response.json()

    async def delete_documents(
        self,
        doc_ids: list[str],
        delete_file: bool = False,
        delete_llm_cache: bool = False,
    ) -> dict[str, Any]:
        response = await self._client.request(
            "DELETE",
            self.ENDPOINTS["delete_documents"],
            json={
                "doc_ids": doc_ids,
                "delete_file": delete_file,
                "delete_llm_cache": delete_llm_cache,
            },
        )
        self._raise_for_status(response)
        return response.json()

    async def track_status(self, track_id: str) -> dict[str, Any]:
        endpoint = self.ENDPOINTS["track_status"].format(
            track_id=quote(track_id, safe="")
        )
        response = await self._client.get(endpoint)
        self._raise_for_status(response)
        return response.json()

    async def paginated_documents(
        self,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        response = await self._client.post(
            self.ENDPOINTS["paginated_documents"],
            json={
                "page": page,
                "page_size": page_size,
                "sort_field": "updated_at",
                "sort_direction": "desc",
            },
        )
        self._raise_for_status(response)
        return response.json()

    async def query(
        self,
        query: str,
        mode: str = "mix",
        top_k: int | None = None,
    ) -> dict[str, Any]:
        payload = self._query_payload(query=query, mode=mode, top_k=top_k)
        response = await self._client.post(self.ENDPOINTS["query"], json=payload)
        self._raise_for_status(response)
        return response.json()

    async def query_data(
        self,
        query: str,
        mode: str = "mix",
        top_k: int | None = None,
    ) -> dict[str, Any]:
        payload = self._query_payload(query=query, mode=mode, top_k=top_k)
        response = await self._client.post(self.ENDPOINTS["query_data"], json=payload)
        self._raise_for_status(response)
        return response.json()

    async def graph(
        self,
        label: str = "*",
        max_depth: int = 3,
        max_nodes: int = 300,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "label": label or "*",
            "max_depth": max_depth,
            "max_nodes": max_nodes,
        }
        response = await self._client.get(self.ENDPOINTS["graph"], params=params)
        self._raise_for_status(response)
        return response.json()

    async def popular_labels(self, limit: int = 50) -> list[str]:
        response = await self._client.get(
            self.ENDPOINTS["popular_labels"],
            params={"limit": limit},
        )
        self._raise_for_status(response)
        return response.json()

    async def search_labels(self, query: str, limit: int = 50) -> list[str]:
        response = await self._client.get(
            self.ENDPOINTS["search_labels"],
            params={"q": query, "limit": limit},
        )
        self._raise_for_status(response)
        return response.json()

    def _query_payload(
        self,
        query: str,
        mode: str,
        top_k: int | None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"query": query, "mode": mode}
        if top_k is not None:
            payload["top_k"] = top_k
        return payload

    def _raise_for_status(self, response: httpx.Response) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = self._response_error_detail(response)
            if not detail:
                raise
            message = (
                f"{response.status_code} {response.reason_phrase} from LightRAG "
                f"{response.request.method} {response.request.url}: {detail}"
            )
            raise httpx.HTTPStatusError(
                message,
                request=exc.request,
                response=exc.response,
            ) from exc

    def _response_error_detail(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return response.text.strip()

        if isinstance(payload, dict):
            detail = payload.get("detail") or payload.get("message") or payload.get("error")
            if isinstance(detail, str):
                return detail
            if isinstance(detail, dict):
                message = detail.get("message") or detail.get("detail")
                if isinstance(message, str):
                    return message
        return ""
