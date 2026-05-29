from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.schemas import (
    DomainConfigRead,
    DomainConfigUpdate,
    RestartResponse,
    SystemConfigRead,
    SystemConfigUpdate,
)
from app.services.config_manager import (
    ConfigManager,
    RestartDisabledError,
    RestartFailedError,
)


router = APIRouter(prefix="/config", tags=["configuration"])


def get_config_manager(settings: Settings = Depends(get_settings)) -> ConfigManager:
    return ConfigManager(settings)


@router.get("/system", response_model=SystemConfigRead)
def get_system_config(
    manager: ConfigManager = Depends(get_config_manager),
) -> SystemConfigRead:
    return manager.read_system_config()


@router.put("/system", response_model=SystemConfigRead)
def update_system_config(
    update: SystemConfigUpdate,
    manager: ConfigManager = Depends(get_config_manager),
) -> SystemConfigRead:
    return manager.update_system_config(update)


@router.get("/domain", response_model=DomainConfigRead)
def get_domain_config(
    manager: ConfigManager = Depends(get_config_manager),
) -> DomainConfigRead:
    return manager.read_domain_config()


@router.put("/domain", response_model=DomainConfigRead)
def update_domain_config(
    update: DomainConfigUpdate,
    manager: ConfigManager = Depends(get_config_manager),
) -> DomainConfigRead:
    return manager.update_domain_config(
        entity_prompt_yaml=update.entity_prompt_yaml,
        qa_prompt_markdown=update.qa_prompt_markdown,
    )


@router.post("/lightrag/restart", response_model=RestartResponse)
def restart_lightrag(
    manager: ConfigManager = Depends(get_config_manager),
) -> RestartResponse:
    try:
        return manager.restart_lightrag()
    except RestartDisabledError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except RestartFailedError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
