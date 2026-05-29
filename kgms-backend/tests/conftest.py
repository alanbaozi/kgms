from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import database
from app.config import Settings, get_settings
from app.database import Base, get_session
from app.main import create_app


@pytest.fixture
def test_settings(tmp_path: Path) -> Settings:
    kgms_env_path = tmp_path / ".env"
    kgms_env_path.write_text(
        "\n".join(
            [
                "KGMS_DATABASE_URL=sqlite://",
                "KGMS_STORAGE_ROOT=./data/kgms",
                "KGMS_LIGHTRAG_BASE_URL=http://lightrag.example:9621",
                "KGMS_LIGHTRAG_API_KEY=kgms-lightrag-secret",
                "KGMS_PAGEINDEX_BASE_URL=https://api.pageindex.ai",
                "KGMS_PAGEINDEX_API_KEY=pi-test-pageindex-key",
                "KGMS_PAGEINDEX_PROFILE=official",
            ]
        ),
        encoding="utf-8",
    )
    managed_root = tmp_path / "managed-lightrag"
    (managed_root / "prompts" / "entity_type").mkdir(parents=True)
    (managed_root / "prompts" / "query").mkdir(parents=True)
    (managed_root / ".env").write_text(
        "\n".join(
            [
                "HOST=0.0.0.0",
                "PORT=9621",
                "LLM_BINDING_HOST=https://dashscope.aliyuncs.com/compatible-mode/v1",
                "LLM_BINDING_API_KEY=test-dashscope-secret",
                "LLM_MODEL=qwen3.6-plus-2026-04-02",
                "QUERY_LLM_MODEL=qwen3.6-plus-2026-04-02",
                "KEYWORD_LLM_MODEL=deepseek-v4-flash",
                "EMBEDDING_BINDING_HOST=https://dashscope.aliyuncs.com/compatible-mode/v1",
                "EMBEDDING_BINDING_API_KEY=test-dashscope-secret",
                "EMBEDDING_MODEL=text-embedding-v3",
                "EMBEDDING_DIM=1024",
                "RERANK_BINDING_HOST=https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank",
                "RERANK_BINDING_API_KEY=test-dashscope-secret",
                "RERANK_MODEL=qwen3-rerank",
                "MINERU_API_TOKEN=mineru-test-secret",
                "VLM_LLM_BINDING_HOST=https://dashscope.aliyuncs.com/compatible-mode/v1",
                "VLM_LLM_BINDING_API_KEY=test-dashscope-secret",
                "VLM_LLM_MODEL=qwen3.6-plus-2026-04-02",
            ]
        ),
        encoding="utf-8",
    )
    (managed_root / "prompts" / "entity_type" / "military.yml").write_text(
        "\n".join(
            [
                "entity_types_guidance: |",
                "  - equipment: 装备。",
                "  关系 keywords 使用短语，优先从以下军事语义中选择；多个 keywords 用逗号分隔：",
                "  设计单位、服役于、搭载武器。",
            ]
        ),
        encoding="utf-8",
    )
    (managed_root / "prompts" / "query" / "military_qa.md").write_text(
        "你是面向军事资料的领域问答助手。",
        encoding="utf-8",
    )
    return Settings(
        database_url="sqlite://",
        storage_root=tmp_path,
        kgms_env_path=kgms_env_path,
        managed_lightrag_root=managed_root,
        lightrag_base_url="https://lightrag.test",
        lightrag_api_key="test-lightrag-key",
        pageindex_base_url="https://pageindex.test",
        pageindex_api_key="test-pageindex-key",
        default_top_k=5,
    )


@pytest.fixture
def test_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    try:
        yield engine
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def test_session_factory(test_engine):
    return sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine,
        class_=Session,
        expire_on_commit=False,
    )


@pytest.fixture
def client(monkeypatch, test_settings: Settings, test_engine, test_session_factory):
    def override_get_settings() -> Settings:
        return test_settings

    def override_get_session():
        session = test_session_factory()
        try:
            yield session
        finally:
            session.close()

    monkeypatch.setattr(database, "engine", test_engine)
    monkeypatch.setattr(database, "SessionLocal", test_session_factory)

    app = create_app()
    app.dependency_overrides[get_settings] = override_get_settings
    app.dependency_overrides[get_session] = override_get_session

    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
