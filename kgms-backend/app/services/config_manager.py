from __future__ import annotations

import http.client
import json
import re
import shlex
import socket
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

from app.config import Settings
from app.domain import ENTITY_TYPE_DISPLAY
from app.schemas import (
    DeploymentConfigRead,
    DomainConfigRead,
    EntityTypeConfigRead,
    KgmsSystemConfigRead,
    LightRAGSystemConfigRead,
    RestartResponse,
    SecretRead,
    SystemConfigRead,
    SystemConfigUpdate,
)


KGMS_ENV_FIELDS: dict[str, str] = {
    "lightrag_base_url": "KGMS_LIGHTRAG_BASE_URL",
    "lightrag_api_key": "KGMS_LIGHTRAG_API_KEY",
    "pageindex_base_url": "KGMS_PAGEINDEX_BASE_URL",
    "pageindex_api_key": "KGMS_PAGEINDEX_API_KEY",
    "pageindex_profile": "KGMS_PAGEINDEX_PROFILE",
    "pageindex_timeout_seconds": "KGMS_PAGEINDEX_TIMEOUT_SECONDS",
    "default_top_k": "KGMS_DEFAULT_TOP_K",
}

LIGHTRAG_ENV_FIELDS: dict[str, str] = {
    "host": "HOST",
    "port": "PORT",
    "llm_binding_host": "LLM_BINDING_HOST",
    "llm_binding_api_key": "LLM_BINDING_API_KEY",
    "llm_model": "LLM_MODEL",
    "query_llm_model": "QUERY_LLM_MODEL",
    "keyword_llm_model": "KEYWORD_LLM_MODEL",
    "embedding_binding_host": "EMBEDDING_BINDING_HOST",
    "embedding_binding_api_key": "EMBEDDING_BINDING_API_KEY",
    "embedding_model": "EMBEDDING_MODEL",
    "embedding_dim": "EMBEDDING_DIM",
    "rerank_binding_host": "RERANK_BINDING_HOST",
    "rerank_binding_api_key": "RERANK_BINDING_API_KEY",
    "rerank_model": "RERANK_MODEL",
    "mineru_api_token": "MINERU_API_TOKEN",
    "vlm_llm_binding_host": "VLM_LLM_BINDING_HOST",
    "vlm_llm_binding_api_key": "VLM_LLM_BINDING_API_KEY",
    "vlm_llm_model": "VLM_LLM_MODEL",
}

SECRET_FIELDS = {
    "lightrag_api_key",
    "pageindex_api_key",
    "llm_binding_api_key",
    "embedding_binding_api_key",
    "rerank_binding_api_key",
    "mineru_api_token",
    "vlm_llm_binding_api_key",
}

FALLBACK_RELATION_KEYWORDS = [
    "所属国家",
    "隶属",
    "服役于",
    "部署于",
    "设计单位",
    "制造单位",
    "总设计师",
    "搭载武器",
    "具备能力",
    "发生时间",
    "发生于",
    "参与方",
    "参与装备",
    "执行主体",
    "动作对象",
    "使用装备",
    "属于事件",
]

ENV_LINE_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$")


class ConfigManager:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def kgms_env_path(self) -> Path:
        return Path(self.settings.kgms_env_path)

    @property
    def managed_root(self) -> Path:
        return Path(self.settings.managed_lightrag_root)

    @property
    def lightrag_env_path(self) -> Path:
        return self.managed_root / ".env"

    @property
    def entity_prompt_path(self) -> Path:
        return self.managed_root / "prompts" / "entity_type" / "military.yml"

    @property
    def qa_prompt_path(self) -> Path:
        return self.managed_root / "prompts" / "query" / "military_qa.md"

    def read_system_config(
        self,
        *,
        requires_kgms_restart: bool = False,
        requires_lightrag_restart: bool = False,
    ) -> SystemConfigRead:
        kgms_env = read_env_file(self.kgms_env_path)
        lightrag_env = read_env_file(self.lightrag_env_path)
        return SystemConfigRead(
            kgms=KgmsSystemConfigRead(
                lightrag_base_url=_get_env(
                    kgms_env,
                    "KGMS_LIGHTRAG_BASE_URL",
                    self.settings.lightrag_base_url,
                ),
                lightrag_api_key=secret_read(
                    _get_env(
                        kgms_env,
                        "KGMS_LIGHTRAG_API_KEY",
                        self.settings.lightrag_api_key,
                    )
                ),
                pageindex_base_url=_get_env(
                    kgms_env,
                    "KGMS_PAGEINDEX_BASE_URL",
                    self.settings.pageindex_base_url,
                ),
                pageindex_api_key=secret_read(
                    _get_env(
                        kgms_env,
                        "KGMS_PAGEINDEX_API_KEY",
                        self.settings.pageindex_api_key,
                    )
                ),
                pageindex_profile=_get_env(
                    kgms_env,
                    "KGMS_PAGEINDEX_PROFILE",
                    self.settings.pageindex_profile,
                ),
                pageindex_timeout_seconds=_as_float(
                    _get_env(
                        kgms_env,
                        "KGMS_PAGEINDEX_TIMEOUT_SECONDS",
                        str(self.settings.pageindex_timeout_seconds),
                    ),
                    self.settings.pageindex_timeout_seconds,
                ),
                default_top_k=_as_int(
                    _get_env(
                        kgms_env,
                        "KGMS_DEFAULT_TOP_K",
                        str(self.settings.default_top_k),
                    ),
                    self.settings.default_top_k,
                ),
            ),
            lightrag=LightRAGSystemConfigRead(
                host=_get_env(lightrag_env, "HOST", "0.0.0.0"),
                port=_as_int(_get_env(lightrag_env, "PORT", "9621"), 9621),
                llm_binding_host=_get_env(lightrag_env, "LLM_BINDING_HOST", ""),
                llm_binding_api_key=secret_read(
                    _get_env(lightrag_env, "LLM_BINDING_API_KEY", "")
                ),
                llm_model=_get_env(lightrag_env, "LLM_MODEL", ""),
                query_llm_model=_get_env(lightrag_env, "QUERY_LLM_MODEL", ""),
                keyword_llm_model=_get_env(lightrag_env, "KEYWORD_LLM_MODEL", ""),
                embedding_binding_host=_get_env(
                    lightrag_env,
                    "EMBEDDING_BINDING_HOST",
                    "",
                ),
                embedding_binding_api_key=secret_read(
                    _get_env(lightrag_env, "EMBEDDING_BINDING_API_KEY", "")
                ),
                embedding_model=_get_env(lightrag_env, "EMBEDDING_MODEL", ""),
                embedding_dim=_as_int(
                    _get_env(lightrag_env, "EMBEDDING_DIM", "0"),
                    0,
                ),
                rerank_binding_host=_get_env(lightrag_env, "RERANK_BINDING_HOST", ""),
                rerank_binding_api_key=secret_read(
                    _get_env(lightrag_env, "RERANK_BINDING_API_KEY", "")
                ),
                rerank_model=_get_env(lightrag_env, "RERANK_MODEL", ""),
                mineru_api_token=secret_read(
                    _get_env(lightrag_env, "MINERU_API_TOKEN", "")
                ),
                vlm_llm_binding_host=_get_env(
                    lightrag_env,
                    "VLM_LLM_BINDING_HOST",
                    "",
                ),
                vlm_llm_binding_api_key=secret_read(
                    _get_env(lightrag_env, "VLM_LLM_BINDING_API_KEY", "")
                ),
                vlm_llm_model=_get_env(lightrag_env, "VLM_LLM_MODEL", ""),
            ),
            deployment=self._deployment_read(),
            requires_kgms_restart=requires_kgms_restart,
            requires_lightrag_restart=requires_lightrag_restart,
        )

    def update_system_config(self, update: SystemConfigUpdate) -> SystemConfigRead:
        kgms_updates = _model_updates(update.kgms, KGMS_ENV_FIELDS)
        lightrag_updates = _model_updates(update.lightrag, LIGHTRAG_ENV_FIELDS)

        if kgms_updates:
            write_env_updates(self.kgms_env_path, kgms_updates)
        if lightrag_updates:
            write_env_updates(self.lightrag_env_path, lightrag_updates)

        return self.read_system_config(
            requires_kgms_restart=bool(kgms_updates),
            requires_lightrag_restart=bool(lightrag_updates),
        )

    def read_domain_config(self) -> DomainConfigRead:
        entity_prompt = read_text_if_exists(self.entity_prompt_path)
        qa_prompt = read_text_if_exists(self.qa_prompt_path)
        return DomainConfigRead(
            entity_types=[
                EntityTypeConfigRead(
                    key=item.key,
                    display_name=item.display_name,
                    color=item.color,
                )
                for item in ENTITY_TYPE_DISPLAY.values()
            ],
            relation_keywords=extract_relation_keywords(entity_prompt),
            entity_prompt_yaml=entity_prompt,
            qa_prompt_markdown=qa_prompt,
        )

    def update_domain_config(
        self,
        *,
        entity_prompt_yaml: str,
        qa_prompt_markdown: str,
    ) -> DomainConfigRead:
        write_text_with_backup(self.entity_prompt_path, entity_prompt_yaml)
        write_text_with_backup(self.qa_prompt_path, qa_prompt_markdown)
        return self.read_domain_config()

    def restart_lightrag(self) -> RestartResponse:
        if not self.settings.lightrag_restart_enabled:
            raise RestartDisabledError("LightRAG restart is disabled")

        if self.settings.lightrag_restart_strategy == "docker_socket":
            output = recreate_container_via_docker_socket(
                self.settings.docker_socket_path,
                self.settings.lightrag_container_name,
                self.lightrag_env_path,
            )
            return RestartResponse(status="recreated", output=output)

        command = [
            *shlex.split(self.settings.docker_compose_command),
            "up",
            "-d",
            "--force-recreate",
            "--no-deps",
            "lightrag",
        ]
        result = subprocess.run(
            command,
            cwd=self.managed_root,
            capture_output=True,
            check=False,
            text=True,
        )
        output = "\n".join(part for part in [result.stdout, result.stderr] if part)
        if result.returncode != 0:
            raise RestartFailedError(output or f"Exit code {result.returncode}")
        return RestartResponse(status="recreated", output=output)

    def _deployment_read(self) -> DeploymentConfigRead:
        return DeploymentConfigRead(
            managed_root=str(self.managed_root),
            kgms_env_path=str(self.kgms_env_path),
            lightrag_env_path=str(self.lightrag_env_path),
            entity_prompt_path=str(self.entity_prompt_path),
            qa_prompt_path=str(self.qa_prompt_path),
            restart_enabled=self.settings.lightrag_restart_enabled,
            restart_strategy=self.settings.lightrag_restart_strategy,
            lightrag_container_name=self.settings.lightrag_container_name,
        )


class RestartDisabledError(RuntimeError):
    pass


class RestartFailedError(RuntimeError):
    pass


class UnixSocketHTTPConnection(http.client.HTTPConnection):
    def __init__(self, socket_path: Path) -> None:
        super().__init__("localhost")
        self.socket_path = socket_path

    def connect(self) -> None:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.connect(str(self.socket_path))
        self.sock = sock


def recreate_container_via_docker_socket(
    socket_path: Path,
    container_name: str,
    env_path: Path,
) -> str:
    if not socket_path.exists():
        raise RestartFailedError(f"Docker socket not found: {socket_path}")

    container_ref = quote(container_name, safe="")
    inspect_body = docker_socket_request(
        socket_path,
        "GET",
        f"/containers/{container_ref}/json",
        expected_statuses={200},
    )
    container_info = json.loads(inspect_body)
    create_payload = build_recreate_container_payload(
        container_info,
        read_env_file(env_path),
    )

    docker_socket_request(
        socket_path,
        "POST",
        f"/containers/{container_ref}/stop?t=10",
        expected_statuses={204, 304},
    )
    docker_socket_request(
        socket_path,
        "DELETE",
        f"/containers/{container_ref}?force=false",
        expected_statuses={204},
    )
    create_body = docker_socket_request(
        socket_path,
        "POST",
        f"/containers/create?name={container_ref}",
        payload=create_payload,
        expected_statuses={201},
    )
    created = json.loads(create_body) if create_body else {}
    new_container_ref = quote(str(created.get("Id") or container_name), safe="")
    docker_socket_request(
        socket_path,
        "POST",
        f"/containers/{new_container_ref}/start",
        expected_statuses={204, 304},
    )

    return f"{container_name} recreated"


def docker_socket_request(
    socket_path: Path,
    method: str,
    path: str,
    *,
    payload: dict[str, Any] | None = None,
    expected_statuses: set[int],
) -> str:
    body: bytes | None = None
    headers: dict[str, str] = {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    connection = UnixSocketHTTPConnection(socket_path)
    try:
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        response_body = response.read().decode("utf-8", errors="replace")
    except OSError as exc:
        raise RestartFailedError(f"Docker socket request failed: {exc}") from exc
    finally:
        connection.close()

    if response.status not in expected_statuses:
        detail = response_body.strip() or response.reason or f"HTTP {response.status}"
        raise RestartFailedError(detail)
    return response_body


CREATE_CONFIG_FIELDS = {
    "AttachStderr",
    "AttachStdin",
    "AttachStdout",
    "Cmd",
    "Domainname",
    "Entrypoint",
    "Env",
    "ExposedPorts",
    "Healthcheck",
    "Hostname",
    "Image",
    "Labels",
    "MacAddress",
    "NetworkDisabled",
    "OnBuild",
    "OpenStdin",
    "Shell",
    "StdinOnce",
    "StopSignal",
    "StopTimeout",
    "Tty",
    "User",
    "Volumes",
    "WorkingDir",
}


def build_recreate_container_payload(
    container_info: dict[str, Any],
    env_updates: dict[str, str],
) -> dict[str, Any]:
    config = container_info.get("Config") or {}
    payload = {
        key: value
        for key in CREATE_CONFIG_FIELDS
        if (value := config.get(key)) is not None
    }
    payload["Env"] = merge_env(config.get("Env") or [], env_updates)
    payload["HostConfig"] = {
        key: value
        for key, value in (container_info.get("HostConfig") or {}).items()
        if value is not None
    }

    endpoints = build_network_endpoints(container_info)
    if endpoints:
        payload["NetworkingConfig"] = {"EndpointsConfig": endpoints}
    return payload


def merge_env(existing: list[str], updates: dict[str, str]) -> list[str]:
    values: dict[str, str] = {}
    order: list[str] = []
    for item in existing:
        key, separator, value = item.partition("=")
        if not separator:
            continue
        values[key] = value
        order.append(key)

    for key, value in updates.items():
        if key not in values:
            order.append(key)
        values[key] = value

    seen: set[str] = set()
    merged: list[str] = []
    for key in order:
        if key in seen:
            continue
        seen.add(key)
        merged.append(f"{key}={values[key]}")
    return merged


def build_network_endpoints(container_info: dict[str, Any]) -> dict[str, dict[str, Any]]:
    networks = (container_info.get("NetworkSettings") or {}).get("Networks") or {}
    endpoints: dict[str, dict[str, Any]] = {}
    for network_name, network in networks.items():
        endpoint: dict[str, Any] = {}
        for key in ("Aliases", "Links", "DriverOpts", "IPAMConfig"):
            value = network.get(key)
            if value:
                endpoint[key] = value
        endpoints[network_name] = endpoint
    return endpoints


def read_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = ENV_LINE_RE.match(line.strip())
        if not match:
            continue
        values[match.group(1)] = unquote_env_value(match.group(2).strip())
    return values


def write_env_updates(path: Path, updates: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    seen: set[str] = set()
    output: list[str] = []

    for line in lines:
        match = ENV_LINE_RE.match(line.strip())
        if not match:
            output.append(line)
            continue
        key = match.group(1)
        if key not in updates:
            output.append(line)
            continue
        output.append(f"{key}={format_env_value(updates[key])}")
        seen.add(key)

    for key, value in updates.items():
        if key not in seen:
            output.append(f"{key}={format_env_value(value)}")

    path.write_text("\n".join(output) + "\n", encoding="utf-8")


def write_text_with_backup(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
        backup = path.with_name(f"{path.name}.bak-{timestamp}")
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    path.write_text(content, encoding="utf-8")


def read_text_if_exists(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def secret_read(value: str | None) -> SecretRead:
    if not value:
        return SecretRead(masked="", is_set=False)
    return SecretRead(masked=mask_secret(value), is_set=True)


def mask_secret(value: str) -> str:
    if len(value) <= 4:
        return "****"
    if value.startswith("sk-"):
        return f"{value[:5]}****{value[-4:]}"
    if len(value) <= 10:
        return f"{value[:2]}****{value[-2:]}"
    return f"{value[:4]}****{value[-4:]}"


def unquote_env_value(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def format_env_value(value: Any) -> str:
    text = str(value)
    if not text or re.search(r"\s|#|'|\"", text):
        escaped = text.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return text


def extract_relation_keywords(prompt: str) -> list[str]:
    marker_index = prompt.find("关系 keywords")
    if marker_index < 0:
        return FALLBACK_RELATION_KEYWORDS

    relation_text = prompt[marker_index:]
    relation_text = relation_text.split("\n\n", 1)[0]
    if "：" in relation_text:
        relation_text = relation_text.split("：", 1)[1]
    candidates = re.split(r"[、,，。\n\r]+", relation_text)
    keywords = [item.strip(" -\t") for item in candidates if item.strip(" -\t")]
    return keywords or FALLBACK_RELATION_KEYWORDS


def _get_env(values: dict[str, str], key: str, default: str) -> str:
    return values.get(key, default)


def _as_int(value: str, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _as_float(value: str, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _model_updates(model: Any, field_map: dict[str, str]) -> dict[str, Any]:
    if model is None:
        return {}

    updates: dict[str, Any] = {}
    for field_name, value in model.model_dump(exclude_none=True).items():
        if field_name in SECRET_FIELDS and value == "":
            continue
        if field_name not in field_map:
            continue
        updates[field_map[field_name]] = value
    return updates
