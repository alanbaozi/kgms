from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app import database
from app.routers import configuration, documents, knowledge_graph, retrieval


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    database.init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="KGMS Backend", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {
            "service": "KGMS Backend",
            "docs_url": "/docs",
            "openapi_url": "/openapi.json",
        }

    @app.get("/webui", include_in_schema=False)
    def webui_redirect() -> RedirectResponse:
        return RedirectResponse(url="/docs")

    app.include_router(documents.router, prefix="/api")
    app.include_router(retrieval.router, prefix="/api")
    app.include_router(configuration.router, prefix="/api")
    app.include_router(knowledge_graph.router, prefix="/api")
    return app


app = create_app()
