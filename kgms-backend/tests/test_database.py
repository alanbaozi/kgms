from app.database import make_engine


def test_make_engine_creates_sqlite_parent_directory(tmp_path) -> None:
    database_path = tmp_path / "nested" / "kgms.db"

    engine = make_engine(f"sqlite:///{database_path}")
    try:
        with engine.connect():
            pass
    finally:
        engine.dispose()

    assert database_path.parent.exists()
