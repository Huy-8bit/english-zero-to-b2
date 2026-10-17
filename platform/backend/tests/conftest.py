import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture(scope="session")
def app():
    return create_app("sqlite:///:memory:")


@pytest.fixture()
def client(app):
    # fresh database per test
    from app.database import Base

    engine = app.state.sessionmaker.kw["bind"]
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return TestClient(app)


@pytest.fixture(scope="session")
def store(app):
    return app.state.store
