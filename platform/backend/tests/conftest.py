import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# app.main creates its default application at import. Keep ALL test side effects
# away from the user's database, audio cache, credentials and access token.
_test_data = tempfile.TemporaryDirectory(prefix="english-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_test_data.name) / 'default.db'}"
os.environ["MEDIA_DIR"] = str(Path(_test_data.name) / "media")
os.environ["AI_PROVIDER"] = "disabled"
os.environ["APP_ACCESS_TOKEN"] = ""

from app.main import create_app


@pytest.fixture(scope="session")
def app():
    return create_app("sqlite:///:memory:")


@pytest.fixture()
def client(app):
    # fresh database per test
    from sqlalchemy import text

    from app.database import Base, init_db

    engine = app.state.sessionmaker.kw["bind"]
    Base.metadata.drop_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
    init_db(engine)
    return TestClient(app)


@pytest.fixture(scope="session")
def store(app):
    return app.state.store


@pytest.fixture(autouse=True)
def isolated_media(tmp_path, monkeypatch):
    from app import config

    monkeypatch.setattr(config, "MEDIA_DIR", tmp_path / "media")
