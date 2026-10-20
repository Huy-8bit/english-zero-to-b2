"""SQLAlchemy engine/session. SQLite locally; any SQLAlchemy URL (e.g. PostgreSQL) via DATABASE_URL."""
from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL


class Base(DeclarativeBase):
    pass


def make_engine(url: str = DATABASE_URL):
    kwargs = {}
    if url.startswith("sqlite"):
        path = url.replace("sqlite:///", "", 1)
        if path and path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        # wait up to 30 s for another writer instead of the default 5 s ("database is locked")
        kwargs["connect_args"] = {"check_same_thread": False, "timeout": float(os.environ.get("SQLITE_BUSY_TIMEOUT", "5"))}
        if ":memory:" in url:
            from sqlalchemy.pool import StaticPool

            kwargs["poolclass"] = StaticPool
    engine = create_engine(url, future=True, **kwargs)
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _pragma(conn, _):  # pragma: no cover - trivial
            cur = conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA journal_mode=WAL")
            cur.close()
    return engine


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


BACKEND_DIR = Path(__file__).resolve().parents[1]


def init_db(bind=None) -> None:
    """Bring the schema to the latest Alembic revision.

    Databases created before migrations existed (tables present, no alembic_version) are stamped
    at the baseline first, so learning data is kept.
    """
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import inspect

    from . import models  # noqa: F401

    target = bind or engine
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.attributes["configure_logger"] = False
    with target.begin() as conn:
        cfg.attributes["connection"] = conn
        tables = set(inspect(conn).get_table_names())
        if "users" in tables and "alembic_version" not in tables:
            command.stamp(cfg, "0001")
        command.upgrade(cfg, "head")
