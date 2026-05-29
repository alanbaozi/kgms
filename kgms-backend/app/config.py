from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/kgms.db"
    storage_root: Path = Path("./data/kgms")
    kgms_env_path: Path = Field(
        default=PROJECT_ROOT / ".env",
        validation_alias=AliasChoices("KGMS_ENV_PATH", "KGMS_KGMS_ENV_PATH"),
    )
    managed_lightrag_root: Path = PROJECT_ROOT / "mock" / "lightrag-server"
    lightrag_restart_enabled: bool = False
    lightrag_restart_strategy: str = "compose"
    lightrag_container_name: str = "kgms-lightrag"
    docker_socket_path: Path = Path("/var/run/docker.sock")
    docker_compose_command: str = "docker compose"
    lightrag_base_url: str = "https://lightrag.example"
    lightrag_api_key: str = ""
    lightrag_timeout_seconds: float = Field(default=180.0, ge=1)
    pageindex_base_url: str = "https://api.pageindex.ai"
    pageindex_api_key: str = ""
    pageindex_profile: str = "official"
    pageindex_timeout_seconds: float = Field(default=180.0, ge=1)
    default_top_k: int = Field(default=10, ge=1)

    model_config = SettingsConfigDict(
        env_prefix="KGMS_",
        env_file=(PROJECT_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
