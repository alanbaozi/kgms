import argparse
import asyncio
import json
import time
from pathlib import Path

from app import database
from app.config import get_settings
from app.database import SessionLocal
from app.domain import IndexTarget
from app.services.document_service import (
    create_document,
    sync_lightrag_status,
    sync_pageindex,
    to_document_read,
)
from app.services.file_storage import FileStorage
from app.services.lightrag_client import LightRAGClient
from app.services.pageindex_client import PageIndexClient


class LocalUpload:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.filename = path.name
        self.content_type = "application/pdf"
        self.file = path.open("rb")

    def close(self) -> None:
        self.file.close()


def print_json(label: str, data: object) -> None:
    print(f"{label}={json.dumps(data, ensure_ascii=False, default=str)}")


async def run(args: argparse.Namespace) -> None:
    settings = get_settings()
    database.init_db()

    pdf = Path(args.file)
    if not pdf.exists():
        raise FileNotFoundError(pdf)

    upload = LocalUpload(pdf)
    session = SessionLocal()
    started = time.perf_counter()

    try:
        async with (
            LightRAGClient(
                settings.lightrag_base_url,
                api_key=settings.lightrag_api_key or None,
                timeout=args.timeout,
            ) as lightrag,
            PageIndexClient(
                settings.pageindex_base_url,
                api_key=settings.pageindex_api_key,
                profile=settings.pageindex_profile,
                timeout=args.timeout,
            ) as pageindex,
        ):
            document = await create_document(
                session=session,
                upload=upload,
                index_target=IndexTarget(args.index_target),
                storage=FileStorage(settings.storage_root),
                lightrag=lightrag,
                pageindex=pageindex,
            )
            print_json(
                "UPLOAD_RESULT",
                {
                    "elapsed_seconds": round(time.perf_counter() - started, 3),
                    "document": to_document_read(document).model_dump(mode="json"),
                },
            )

            if args.track_lightrag and document.lightrag_track_id:
                for attempt in range(1, args.lightrag_attempts + 1):
                    try:
                        synced = await sync_lightrag_status(
                            session=session,
                            document_id=document.id,
                            lightrag=lightrag,
                        )
                        print_json(
                            "LIGHTRAG_SYNC_RESULT",
                            {
                                "attempt": attempt,
                                "document": to_document_read(synced).model_dump(
                                    mode="json"
                                ),
                            },
                        )
                        if synced.lightrag_status in {"completed", "failed"}:
                            break
                    except Exception as exc:  # noqa: BLE001
                        print_json(
                            "LIGHTRAG_SYNC_ERROR",
                            {"attempt": attempt, "error": repr(exc)},
                        )
                    if attempt < args.lightrag_attempts:
                        await asyncio.sleep(args.lightrag_interval)

            if args.sync_pageindex:
                for attempt in range(1, args.sync_attempts + 1):
                    try:
                        synced = await sync_pageindex(
                            session=session,
                            document_id=document.id,
                            storage=FileStorage(settings.storage_root),
                            pageindex=pageindex,
                        )
                        print_json(
                            "PAGEINDEX_SYNC_RESULT",
                            {
                                "attempt": attempt,
                                "document": to_document_read(synced).model_dump(
                                    mode="json"
                                ),
                            },
                        )
                        break
                    except Exception as exc:  # noqa: BLE001
                        print_json(
                            "PAGEINDEX_SYNC_ERROR",
                            {"attempt": attempt, "error": repr(exc)},
                        )
                        if attempt < args.sync_attempts:
                            await asyncio.sleep(args.sync_interval)
    finally:
        upload.close()
        session.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload a document through KGMS.")
    parser.add_argument("--file", required=True, help="PDF file path")
    parser.add_argument(
        "--index-target",
        default=IndexTarget.BOTH.value,
        choices=[target.value for target in IndexTarget],
    )
    parser.add_argument("--timeout", type=float, default=180)
    parser.add_argument("--sync-pageindex", action="store_true")
    parser.add_argument("--sync-attempts", type=int, default=6)
    parser.add_argument("--sync-interval", type=float, default=20)
    parser.add_argument("--track-lightrag", action="store_true")
    parser.add_argument("--lightrag-attempts", type=int, default=1)
    parser.add_argument("--lightrag-interval", type=float, default=20)
    return parser.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
