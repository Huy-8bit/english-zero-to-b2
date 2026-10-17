"""Upgrade legacy data in disposable databases; never downgrade learner storage."""
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import BACKEND_DIR, init_db, make_engine
from app.main import create_app


@pytest.mark.parametrize("unversioned", [False, True])
def test_legacy_upgrade_preserves_records_and_restarts(tmp_path, unversioned):
    url = f"sqlite:///{tmp_path / 'legacy.db'}"
    engine = make_engine(url)
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.attributes["configure_logger"] = False
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "0001")
        conn.execute(text("INSERT INTO users (id,name,created_at,daily_goal_minutes,weekly_goal_lessons) "
                          "VALUES (1,'Existing learner',CURRENT_TIMESTAMP,25,4)"))
        conn.execute(text("INSERT INTO attempts (id,user_id,unit_id,quiz_id,item_id,response,verdict,auto,created_at) "
                          "VALUES (1,1,'A1-G011','A1-G011:L1','A1-G011:L1.1','B','correct',1,CURRENT_TIMESTAMP)"))
        if unversioned:
            conn.execute(text("DROP TABLE alembic_version"))
    init_db(engine)
    init_db(engine)  # repeated startup is idempotent
    with engine.connect() as conn:
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0003"
        attempt = conn.execute(text("SELECT response,verdict,ai_correct,ai_score FROM attempts WHERE id=1")).one()
        assert tuple(attempt) == ("B", "correct", None, None)
        assert conn.execute(text("PRAGMA foreign_key_check")).all() == []
    first = create_app(url)
    with TestClient(first) as client:
        assert client.get("/api/profile").json()["name"] == "Existing learner"
        assert client.put("/api/progress/A1-G011", json={"current_step": 4, "state": {"drafts": {"answer": "keep me"}}}).status_code == 200
        assert client.put("/api/notes/A1-G011", json={"text": "My existing note"}).status_code == 200
    first.state.sessionmaker.kw["bind"].dispose()
    with TestClient(create_app(url)) as client:
        state = client.get("/api/lessons/A1-G011/steps").json()["progress"]
        assert state["current_step"] == 4 and state["state"]["drafts"]["answer"] == "keep me"
        assert client.get("/api/notes/A1-G011").json()["text"] == "My existing note"
    engine.dispose()
