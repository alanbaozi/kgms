from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(database_url: str) -> Engine:
    connect_args = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        _ensure_sqlite_parent_dir(database_url)
    return create_engine(database_url, connect_args=connect_args, future=True)


def _ensure_sqlite_parent_dir(database_url: str) -> None:
    url = make_url(database_url)
    if not url.database or url.database == ":memory:":
        return

    database_path = Path(url.database)
    if database_path.parent != Path("."):
        database_path.parent.mkdir(parents=True, exist_ok=True)


def make_session_factory(db_engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=db_engine,
        class_=Session,
        expire_on_commit=False,
    )


engine = make_engine(get_settings().database_url)
SessionLocal = make_session_factory(engine)


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
