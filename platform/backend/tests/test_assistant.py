"""Learning assistant: deterministic insights (numbers never come from the AI), fallbacks, history."""
import math
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.ai.errors import AIUnavailable
from app.ai.fake import FakeProvider
from app.ai.settings import load_settings
from app.main import create_app
from app.models import ActivityDay, LessonProgress, utcnow


def seed_pace(app, lessons: list[str], days: int = 5):
    """Completed lessons and active days in the last 4 weeks."""
    from app.services.progress import today

    with app.state.sessionmaker() as db:
        for i, u in enumerate(lessons):
            db.add(LessonProgress(user_id=1, unit_id=u, status="completed", current_step=1, max_step=1, total_steps=1, state={},
                                  score=80, best_score=80, completed_at=utcnow() - timedelta(days=i), completions=1))
        for d in range(days):
            db.add(ActivityDay(user_id=1, day=today() - timedelta(days=d), seconds=1800, items_answered=5, lessons_completed=0, cards_reviewed=0))
        db.commit()


def test_quick_questions_work_without_ai(client, app):
    client.get("/api/profile")  # creates the learner
    for action in ("progress", "vocab", "eta", "mistakes", "next"):
        r = client.post("/api/assistant/chat", json={"action": action}).json()
        assert r["ai"] is False and r["notice"] and r["answer"] and r["topic"] == action
    r = client.post("/api/assistant/chat", json={"message": "Khi nào tôi xong B2?"}).json()
    assert r["topic"] == "eta" and "tuần" in r["answer"] and "ước lượng" in r["answer"].lower()
    r = client.post("/api/assistant/chat", json={"message": "Kể chuyện cười đi"}).json()
    assert r["topic"] is None and "câu hỏi nhanh" in r["answer"]
    hist = client.get("/api/assistant/history").json()
    assert len(hist) == 14 and hist[-1]["role"] == "assistant"
    assert client.delete("/api/assistant/history").json() == {"ok": True}
    assert client.get("/api/assistant/history").json() == []


def test_eta_uses_recent_pace_and_is_consistent(client, app):
    client.get("/api/profile")
    done = ["A0-G001", "A0-G002", "A0-G003", "A0-G004"]
    seed_pace(app, done)
    s = client.get("/api/assistant/insights").json()
    p, e = s["progress"], s["eta"]
    assert p["lessons_completed"] == 4 and p["last_28_days"]["lessons_completed"] == 4 and p["last_28_days"]["active_days"] == 5
    assert e["basis"] == "recent_pace" and e["pace"]["lessons_per_week"] == 1.0
    assert e["remaining_lessons"] == p["lessons_total"] - 4
    assert e["weeks"] == math.ceil(e["remaining_lessons"] / 1.0) and e["finish_date"]
    assert any(step["kind"] == "next_lesson" for step in s["next"]["steps"])


def test_eta_without_enough_data_uses_weekly_goal(client):
    client.put("/api/profile", json={"weekly_goal_lessons": 5})
    e = client.get("/api/assistant/insights").json()["eta"]
    assert e["basis"] == "weekly_goal" and e["weekly_goal"] == 5 and e["weeks"] == math.ceil(e["remaining_lessons"] / 5) and e["note"]


@pytest.fixture(scope="module")
def ai_app():
    settings = load_settings()
    settings.provider = "fake"
    settings.rate_limit_per_minute = 1000
    return create_app("sqlite:///:memory:", ai_settings=settings, ai_provider=FakeProvider())


@pytest.fixture()
def c(ai_app):
    from sqlalchemy import text

    from app.database import Base, init_db

    engine = ai_app.state.sessionmaker.kw["bind"]
    Base.metadata.drop_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
    init_db(engine)
    ai_app.state.ai.gateway.provider.fail_next = None
    return TestClient(ai_app)


def test_ai_answer_gets_learner_data_and_keeps_history(c, ai_app):
    c.get("/api/profile")
    seed_pace(ai_app, ["A0-G001", "A0-G002"])
    r = c.post("/api/assistant/chat", json={"message": "Tiến độ học của tôi thế nào?"}).json()
    assert r["ai"] and "[AI giả lập]" in r["answer"] and r["topic"] == "progress" and r["cards"][0]["title"] == "Tiến độ"
    # quick actions are cached while the data is unchanged
    a = c.post("/api/assistant/chat", json={"action": "next"}).json()
    b = c.post("/api/assistant/chat", json={"action": "next"}).json()
    assert a["answer"] == b["answer"] and ai_app.state.ai.gateway.provider.calls.count("text") == 2
    hist = c.get("/api/assistant/history").json()
    assert [m["role"] for m in hist] == ["user", "assistant"] * 3 and hist[1]["cards"]


def test_ai_outage_falls_back_to_data(c, ai_app):
    ai_app.state.ai.gateway.provider.fail_next = AIUnavailable("down")
    r = c.post("/api/assistant/chat", json={"action": "mistakes"}).json()
    assert not r["ai"] and r["notice"] and ("lỗi" in r["answer"].lower())
