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


def seed_pace(app, lessons: list[str], days: int = 5, minutes_per_lesson: int = 40):
    """Journal rows as the live hooks write them: one lesson per day, completed, plus some vocabulary time."""
    from app.models import StudyLog
    from app.services.progress import today

    with app.state.sessionmaker() as db:
        for i, u in enumerate(lessons):
            d = today() - timedelta(days=i)
            db.add(StudyLog(user_id=1, day=d, activity_key=u, kind="lesson", seconds=minutes_per_lesson * 60, items_answered=10, items_correct=8,
                            cards_reviewed=0, words_learned=0, completed=True, score=80, source="live"))
            db.add(LessonProgress(user_id=1, unit_id=u, status="completed", current_step=1, max_step=1, total_steps=1, state={},
                                  score=80, best_score=80, completed_at=utcnow() - timedelta(days=i), completions=1))
        for i in range(days):
            db.add(StudyLog(user_id=1, day=today() - timedelta(days=i), activity_key="vocab", kind="module", seconds=600, items_answered=12,
                            items_correct=10, cards_reviewed=8, words_learned=3, completed=False, source="live"))
        db.commit()


def test_quick_questions_work_without_ai(client, app):
    client.get("/api/profile")  # creates the learner
    for action in ("progress", "history", "eta", "review", "vocab", "mistakes", "next"):
        r = client.post("/api/assistant/chat", json={"action": action}).json()
        assert r["ai"] is False and r["notice"] and r["answer"] and r["topic"] == action
    r = client.post("/api/assistant/chat", json={"message": "Khi nào tôi xong B2?"}).json()
    assert r["topic"] == "eta" and "tuần" in r["answer"] and "ước lượng" in r["answer"].lower()
    r = client.post("/api/assistant/chat", json={"message": "Kể chuyện cười đi"}).json()
    assert r["topic"] is None and "câu hỏi nhanh" in r["answer"]
    hist = client.get("/api/assistant/history").json()
    assert len(hist) == 18 and hist[-1]["role"] == "assistant"
    assert client.delete("/api/assistant/history").json() == {"ok": True}
    assert client.get("/api/assistant/history").json() == []


def test_journal_pace_and_eta_from_recorded_study(client, app, store):
    client.get("/api/profile")
    done = ["A0-G001", "A0-G002", "A0-G003", "A0-G004"]
    seed_pace(app, done)
    s = client.get("/api/assistant/insights").json()
    day0 = s["journal"][0]
    assert day0["lessons"][0]["key"] == "A0-G001" and day0["lessons"][0]["completed"] and day0["minutes"] == 50 and day0["accuracy"] == 82
    pace = s["pace"]
    assert pace["study_days"] == 5 and pace["minutes_total"] == 4 * 40 + 5 * 10 and pace["lessons_completed"] == 4
    expected_factor = round(max(0.3, min(4.0, 160 / sum(store.units[u].minutes or 30 for u in done))), 2)
    assert pace["personal_speed_factor"] == expected_factor
    e = s["eta"]
    assert e["basis"] == "recent_minutes" and e["minutes_basis"] == "tốc độ của bạn"
    assert e["weeks"] == math.ceil(e["remaining_minutes"] / pace["lesson_minutes_per_week"])
    one_hour = next(x for x in e["scenarios"] if x["label"] == "1 giờ/ngày")
    assert one_hour["weeks"] == math.ceil(e["remaining_minutes"] / (60 * 7 * e["lesson_share_of_study_time"]))
    assert s["periods"]["last_7_days"]["days"] == 5 and s["periods"]["today"]["lessons"] == ["A0-G001"]
    # history answered from the journal without AI, naming the lessons
    r = client.post("/api/assistant/chat", json={"message": "Hôm qua tôi đã học những gì?"}).json()
    assert r["topic"] == "history" and "A0-G002" in r["answer"]


def test_review_plan_uses_spaced_intervals(client, app):
    client.get("/api/profile")
    seed_pace(app, ["A0-G001"])
    from app.models import StudyLog
    from app.services.progress import today
    with app.state.sessionmaker() as db:  # pretend A0-G001 was completed 10 days ago and never revisited
        db.query(LessonProgress).filter_by(unit_id="A0-G001").update({"completed_at": utcnow() - timedelta(days=10)})
        db.query(StudyLog).filter_by(activity_key="A0-G001").update({"day": today() - timedelta(days=10)})
        db.add(LessonProgress(user_id=1, unit_id="A0-G002", status="review", current_step=1, max_step=1, total_steps=1, state={},
                              score=40, best_score=40, completed_at=utcnow(), completions=1))
        db.commit()
    rv = client.get("/api/assistant/insights").json()["review"]
    ids = [x["lesson_id"] for x in rv["lessons"]]
    assert ids[:2] == ["A0-G002", "A0-G001"]  # low score first, then the overdue revision
    r = client.post("/api/assistant/chat", json={"message": "Tôi cần ôn lại những gì đã học?"}).json()
    assert r["topic"] == "review" and "A0-G001" in r["answer"] and r["cards"][0]["title"] == "Ôn tập"


def test_live_hooks_record_the_journal(client, app):
    client.put("/api/progress/A1-G011", json={"current_step": 0})
    client.post("/api/activity/heartbeat", json={"unit_id": "A1-G011"})
    client.post("/api/activity/heartbeat", json={"activity": "writing-studio"})
    assert client.post("/api/activity/heartbeat", json={"activity": "dashboard"}).status_code == 422
    quiz = next(st for st in client.get("/api/lessons/A1-G011/steps").json()["steps"] if st["type"] == "quiz")
    client.post(f"/api/quizzes/{quiz['quiz_id']}/submit", json={"answers": {quiz["items"][0]["id"]: "B"}})
    s = client.post("/api/vocab/sessions", json={"kind": "flashcards", "size": 3}).json()
    client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": s["items"][0]["id"], "rating": 3})
    day = client.get("/api/assistant/insights").json()["journal"][0]
    lesson = next(l for l in day["lessons"] if l["key"] == "A1-G011")
    assert lesson["minutes"] >= 0 and lesson["items"] == 1
    mods = {m["key"]: m for m in day["modules"]}
    assert mods["vocab"]["items"] == 1 and "writing-studio" in mods and day["vocab_reviews"] == 1


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


def test_pace_window_starts_at_first_study_day(client, app):
    client.get("/api/profile")
    seed_pace(app, ["A0-G001", "A0-G002"], days=2)  # a learner who started yesterday
    s = client.get("/api/assistant/insights").json()
    p = s["pace"]
    assert p["history_days"] == 2 and p["window_days"] == 7 and p["low_confidence"]
    assert p["minutes_per_week"] == 2 * 40 + 2 * 10  # not diluted over 4 weeks
    assert s["eta"]["confidence_note"]
