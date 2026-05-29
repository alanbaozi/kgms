from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_session
from app.dependencies import get_lightrag_client, get_pageindex_client
from app.schemas import RetrievalRequest, RetrievalResponse
from app.services.lightrag_client import LightRAGClient
from app.services.pageindex_client import PageIndexClient
from app.services.retrieval_orchestrator import run_query


router = APIRouter(prefix="/retrieval", tags=["retrieval"])


@router.post("/query", response_model=RetrievalResponse)
async def query_retrieval(
    request: RetrievalRequest,
    session: Session = Depends(get_session),
    lightrag: LightRAGClient = Depends(get_lightrag_client),
    pageindex: PageIndexClient | None = Depends(get_pageindex_client),
) -> RetrievalResponse:
    return await run_query(
        session=session,
        request=request,
        lightrag=lightrag,
        pageindex=pageindex,
    )
