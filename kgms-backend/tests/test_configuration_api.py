import json
from pathlib import Path

from app.services import config_manager


def test_system_config_masks_secret_values(client) -> None:
    response = client.get("/api/config/system")

    assert response.status_code == 200
    data = response.json()
    payload = json.dumps(data, ensure_ascii=False)

    assert data["kgms"]["lightrag_base_url"] == "http://lightrag.example:9621"
    assert data["kgms"]["pageindex_profile"] == "official"
    assert data["kgms"]["pageindex_api_key"]["is_set"] is True
    assert data["kgms"]["pageindex_api_key"]["masked"].startswith("pi")
    assert "pi-test-pageindex-key" not in payload
    assert "test-dashscope-secret" not in payload
    assert data["lightrag"]["llm_model"] == "qwen3.6-plus-2026-04-02"
    assert data["lightrag"]["query_llm_model"] == "qwen3.6-plus-2026-04-02"
    assert data["lightrag"]["embedding_dim"] == 1024
    assert data["lightrag"]["llm_binding_api_key"]["is_set"] is True
    assert data["deployment"]["managed_root"]
    assert data["deployment"]["restart_enabled"] is False
    assert data["deployment"]["restart_strategy"] == "compose"
    assert data["deployment"]["lightrag_container_name"] == "kgms-lightrag"


def test_update_system_config_writes_env_files_and_keeps_blank_secrets(
    client,
    test_settings,
) -> None:
    response = client.put(
        "/api/config/system",
        json={
            "kgms": {
                "lightrag_base_url": "http://127.0.0.1:9621",
                "pageindex_api_key": "",
            },
            "lightrag": {
                "llm_model": "qwen-test",
                "embedding_dim": 1536,
                "llm_binding_api_key": "sk-new-secret",
            },
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["requires_kgms_restart"] is True
    assert data["requires_lightrag_restart"] is True
    assert data["kgms"]["lightrag_base_url"] == "http://127.0.0.1:9621"
    assert data["lightrag"]["llm_model"] == "qwen-test"
    assert data["lightrag"]["embedding_dim"] == 1536
    assert data["lightrag"]["llm_binding_api_key"]["masked"].startswith("sk-")

    kgms_env = Path(test_settings.kgms_env_path).read_text(encoding="utf-8")
    lightrag_env = (test_settings.managed_lightrag_root / ".env").read_text(
        encoding="utf-8"
    )
    assert "KGMS_LIGHTRAG_BASE_URL=http://127.0.0.1:9621" in kgms_env
    assert "KGMS_PAGEINDEX_API_KEY=pi-test-pageindex-key" in kgms_env
    assert "LLM_MODEL=qwen-test" in lightrag_env
    assert "EMBEDDING_DIM=1536" in lightrag_env
    assert "LLM_BINDING_API_KEY=sk-new-secret" in lightrag_env


def test_domain_config_reads_entities_prompts_and_relation_keywords(client) -> None:
    response = client.get("/api/config/domain")

    assert response.status_code == 200
    data = response.json()
    assert {
        "key": "equipment",
        "display_name": "装备",
        "color": "#0891b2",
    } in data["entity_types"]
    assert "设计单位" in data["relation_keywords"]
    assert "entity_types_guidance" in data["entity_prompt_yaml"]
    assert "领域问答助手" in data["qa_prompt_markdown"]


def test_update_domain_config_writes_files_and_creates_backups(
    client,
    test_settings,
) -> None:
    response = client.put(
        "/api/config/domain",
        json={
            "entity_prompt_yaml": "entity_types_guidance: |\n  新的实体抽取说明\n",
            "qa_prompt_markdown": "新的问答 Prompt",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "新的实体抽取说明" in data["entity_prompt_yaml"]
    assert data["qa_prompt_markdown"] == "新的问答 Prompt"

    entity_prompt_path = (
        test_settings.managed_lightrag_root
        / "prompts"
        / "entity_type"
        / "military.yml"
    )
    qa_prompt_path = (
        test_settings.managed_lightrag_root / "prompts" / "query" / "military_qa.md"
    )
    assert "新的实体抽取说明" in entity_prompt_path.read_text(encoding="utf-8")
    assert qa_prompt_path.read_text(encoding="utf-8") == "新的问答 Prompt"
    assert list(entity_prompt_path.parent.glob("military.yml.bak-*"))
    assert list(qa_prompt_path.parent.glob("military_qa.md.bak-*"))


def test_restart_lightrag_disabled_by_default(client) -> None:
    response = client.post("/api/config/lightrag/restart")

    assert response.status_code == 403
    assert "disabled" in response.json()["detail"].lower()


def test_restart_lightrag_recreates_container_with_docker_socket_strategy(
    client,
    test_settings,
    monkeypatch,
) -> None:
    test_settings.lightrag_restart_enabled = True
    test_settings.lightrag_restart_strategy = "docker_socket"
    test_settings.lightrag_container_name = "kgms-lightrag"
    test_settings.docker_socket_path = Path("/var/run/docker.sock")
    calls: list[tuple[Path, str, Path]] = []

    def fake_recreate_container_via_docker_socket(
        socket_path: Path,
        container_name: str,
        env_path: Path,
    ) -> str:
        calls.append((socket_path, container_name, env_path))
        return "kgms-lightrag recreated"

    monkeypatch.setattr(
        config_manager,
        "recreate_container_via_docker_socket",
        fake_recreate_container_via_docker_socket,
    )

    response = client.post("/api/config/lightrag/restart")

    assert response.status_code == 200
    assert response.json() == {
        "status": "recreated",
        "output": "kgms-lightrag recreated",
    }
    assert calls == [
        (
            Path("/var/run/docker.sock"),
            "kgms-lightrag",
            test_settings.managed_lightrag_root / ".env",
        )
    ]


def test_recreate_payload_merges_latest_env_and_preserves_runtime_shape() -> None:
    container_info = {
        "Config": {
            "Image": "kgms/lightrag:test",
            "Cmd": ["python", "-m", "lightrag.api.lightrag_server"],
            "Env": [
                "LLM_MODEL=qwen-old",
                "QUERY_LLM_MODEL=qwen-query",
                "UNCHANGED=value",
            ],
            "Labels": {"com.docker.compose.service": "lightrag"},
            "ExposedPorts": {"9621/tcp": {}},
        },
        "HostConfig": {
            "Binds": ["/host/.env:/app/.env:ro"],
            "NetworkMode": "kgms-lightrag_default",
            "PortBindings": {"9621/tcp": [{"HostIp": "0.0.0.0", "HostPort": "9621"}]},
            "RestartPolicy": {"Name": "unless-stopped"},
        },
        "NetworkSettings": {
            "Networks": {
                "kgms-lightrag_default": {
                    "Aliases": ["kgms-lightrag", "lightrag"],
                    "DNSNames": ["kgms-lightrag", "lightrag", "old-id"],
                    "IPAddress": "172.22.0.8",
                    "EndpointID": "old-endpoint",
                }
            }
        },
    }

    payload = config_manager.build_recreate_container_payload(
        container_info,
        {
            "LLM_MODEL": "qwen-new",
            "EMBEDDING_DIM": "1024",
        },
    )

    assert payload["Image"] == "kgms/lightrag:test"
    assert "LLM_MODEL=qwen-new" in payload["Env"]
    assert "QUERY_LLM_MODEL=qwen-query" in payload["Env"]
    assert "UNCHANGED=value" in payload["Env"]
    assert "EMBEDDING_DIM=1024" in payload["Env"]
    assert payload["HostConfig"]["Binds"] == ["/host/.env:/app/.env:ro"]
    assert payload["HostConfig"]["PortBindings"] == {
        "9621/tcp": [{"HostIp": "0.0.0.0", "HostPort": "9621"}]
    }
    assert payload["NetworkingConfig"]["EndpointsConfig"] == {
        "kgms-lightrag_default": {"Aliases": ["kgms-lightrag", "lightrag"]}
    }
