from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx


class PageIndexClient:
    PROFILES = {
        "dev_v1": {
            "auth": "bearer",
            "upload_document": "/documents",
            "get_document": "/documents/{document_id}",
            "get_document_tree": "/documents/{document_id}/tree",
            "get_document_metadata": "/documents/{document_id}/metadata",
            "retrieve": "/retrieval",
            "get_retrieval": "/retrieval/{retrieval_id}",
            "chat": "/chat/completions",
        },
        "official": {
            "auth": "api_key",
            "upload_document": "/doc/",
            "get_document": "/doc/{document_id}/",
            "get_document_tree": "/doc/{document_id}/",
            "get_document_metadata": "/doc/{document_id}/metadata",
            "retrieve": "/retrieval/",
            "get_retrieval": "/retrieval/{retrieval_id}/",
            "chat": "/chat/completions",
        },
    }

    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout: float = 60.0,
        profile: str | None = None,
    ) -> None:
        api_key = api_key.strip()
        if not api_key:
            raise ValueError("api_key is required")
        try:
            api_key.encode("ascii")
        except UnicodeEncodeError as exc:
            raise ValueError("Please provide a real PageIndex API key") from exc

        self.profile = profile or self._infer_profile(base_url)
        if self.profile not in self.PROFILES:
            raise ValueError(f"Unsupported PageIndex profile: {self.profile}")

        self.endpoints = self.PROFILES[self.profile]
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers=self._auth_headers(api_key, self.endpoints["auth"]),
            timeout=timeout,
        )

    async def __aenter__(self) -> "PageIndexClient":
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
                self.endpoints["upload_document"],
                files={"file": file_tuple},
            )
        response.raise_for_status()
        return response.json()

    async def get_document(
        self,
        document_id: str,
        result_type: str | None = None,
        result_format: str | None = None,
        summary: bool | None = None,
    ) -> dict[str, Any]:
        endpoint_key = (
            "get_document_tree" if result_type == "tree" else "get_document"
        )
        endpoint = self.endpoints[endpoint_key].format(
            document_id=quote(document_id, safe="")
        )
        params: dict[str, Any] = {}
        if result_type is not None and self.profile == "official":
            params["type"] = result_type
        if result_format is not None:
            params["format"] = result_format
        if summary is not None:
            params["summary"] = str(summary).lower()
        response = await self._client.get(endpoint, params=params)
        response.raise_for_status()
        return response.json()

    async def get_document_metadata(self, document_id: str) -> dict[str, Any]:
        endpoint = self.endpoints["get_document_metadata"].format(
            document_id=quote(document_id, safe="")
        )
        response = await self._client.get(endpoint)
        response.raise_for_status()
        return response.json()

    async def retrieve(
        self,
        query: str,
        document_ids: list[str] | None = None,
        top_k: int = 10,
    ) -> dict[str, Any]:
        payload = self._retrieval_payload(query=query, document_ids=document_ids)
        response = await self._client.post(self.endpoints["retrieve"], json=payload)
        response.raise_for_status()
        return response.json()

    async def get_retrieval(self, retrieval_id: str) -> dict[str, Any]:
        endpoint = self.endpoints["get_retrieval"].format(
            retrieval_id=quote(retrieval_id, safe="")
        )
        response = await self._client.get(endpoint)
        response.raise_for_status()
        return response.json()

    async def chat(
        self,
        query: str,
        document_ids: list[str] | None = None,
        top_k: int = 10,
    ) -> dict[str, Any]:
        payload = self._chat_payload(
            query=query,
            document_ids=document_ids,
            top_k=top_k,
        )
        response = await self._client.post(self.endpoints["chat"], json=payload)
        response.raise_for_status()
        return response.json()

    def _infer_profile(self, base_url: str) -> str:
        if "api.pageindex.ai" in base_url:
            return "official"
        return "dev_v1"

    def _auth_headers(self, api_key: str, auth_scheme: str) -> dict[str, str]:
        if auth_scheme == "bearer":
            return {"Authorization": f"Bearer {api_key}"}
        if auth_scheme == "api_key":
            return {"api_key": api_key}
        raise ValueError(f"Unsupported PageIndex auth scheme: {auth_scheme}")

    def _retrieval_payload(
        self,
        query: str,
        document_ids: list[str] | None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"query": query, "thinking": False}
        if document_ids:
            payload["doc_id"] = document_ids[0]
        return payload

    def _chat_payload(
        self,
        query: str,
        document_ids: list[str] | None,
        top_k: int,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "messages": [{"role": "user", "content": query}],
            "stream": False,
        }
        if document_ids:
            payload["doc_id"] = document_ids[0] if len(document_ids) == 1 else document_ids
        payload["top_k"] = top_k
        return payload
