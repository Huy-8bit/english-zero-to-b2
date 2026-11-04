from datetime import datetime

import pytest
from sqlalchemy import func, select

from app.models import Achievement, ActivityDay, Attempt, LearningProfile, LessonProgress, StudyLog, XPEvent
from app.services import adaptive, progress


def rows(client):
    return {p["unit_id"]: p for p in client.get("/api/progress").json()}


def test_mark_up_to_unit_and_repeat(client, store):
    response = client.post("/api/progress/mark-up-to", json={"unit_id": "A1-G003"})
    assert response.status_code == 200
    expected = [u.id for u in store.unit_list if u.kind == "grammar" and u.order <= store.units["A1-G003"].order]
    assert [c["unit_id"] for c in response.json()["changes"]] == expected
    saved = rows(client)
    assert list(saved) == expected
    assert all(p["status"] == "completed" and p["manual"] and p["completed_at"] for p in saved.values())
    assert len({p["completed_at"] for p in saved.values()}) == 1
    assert client.post("/api/progress/mark-up-to", json={"unit_id": "A1-G003"}).json()["count"] == 0
    assert rows(client) == saved
    assert client.get("/api/recommendations").json()["next_lesson"]["id"] == "A1-G004"
    lesson = client.get("/api/lessons/A1-G003").json()
    assert lesson["manual"] and lesson["status"] == "completed"


def test_dry_run_bulk_and_individual_never_write(client, store):
    body = {"level": "A1", "include_skills": True, "dry_run": True}
    preview = client.post("/api/progress/mark-up-to", json=body).json()
    expected = [u.id for u in store.unit_list if u.level in ("A0", "A1") and u.kind in ("grammar", "skills", "communication")]
    assert [c["unit_id"] for c in preview["changes"]] == expected
    assert preview["dry_run"] and preview["count"] == len(expected)
    assert rows(client) == {}
    assert client.post("/api/progress/mark-up-to?dry_run=true", json={"unit_id": "A0-G001"}).json()["count"] == 1
    assert client.put("/api/progress/A0-G001", json={"status": "completed", "dry_run": True}).json()["count"] == 1
    assert rows(client) == {}
    applied = client.post("/api/progress/mark-up-to", json={**body, "dry_run": False}).json()
    assert applied["changes"] == preview["changes"]
    before = rows(client)
    assert client.put("/api/progress/A0-G001?dry_run=true", json={"status": "not_started"}).json()["count"] == 1
    assert rows(client) == before


def test_completed_records_preserve_scores_timestamps_and_origin(client, app):
    client.get("/api/profile")
    stamp = datetime(2020, 1, 2, 3, 4, 5)
    with app.state.sessionmaker() as db:
        db.add(LessonProgress(user_id=1, unit_id="A0-G001", status="completed", score=87, best_score=91,
                              completed_at=stamp, updated_at=stamp, completions=2, state={"draft": "keep"}))
        db.commit()
    before = rows(client)["A0-G001"]
    assert client.post("/api/progress/mark-up-to", json={"unit_id": "A0-G002"}).json()["count"] == 1
    assert client.put("/api/progress/A0-G001", json={"status": "completed"}).json()["count"] == 0
    assert rows(client)["A0-G001"] == before
    with app.state.sessionmaker() as db:
        p = db.scalar(select(LessonProgress).where(LessonProgress.unit_id == "A0-G001"))
        assert p.state == {"draft": "keep"} and p.completions == 2 and p.manual is False
    client.put("/api/progress/A0-G001", json={"status": "not_started"})
    undone = rows(client)["A0-G001"]
    assert undone["completed_at"] is None and undone["score"] == 87 and undone["best_score"] == 91


def test_manual_progress_does_not_earn_activity_or_future_achievements(client, app, store):
    assert client.post("/api/progress/mark-up-to", json={"level": "A1"}).status_code == 200
    with app.state.sessionmaker() as db:
        # Later achievement checks must also exclude the manually marked lessons.
        assert progress.check_achievements(db, 1, store) == []
        db.commit()
        for model in (XPEvent, ActivityDay, Achievement, StudyLog, Attempt):
            assert db.scalar(select(func.count()).select_from(model)) == 0
        assert progress.streak(db, 1) == 0
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["xp"]["total"] == 0
    with app.state.sessionmaker() as db:
        db.add(LessonProgress(user_id=1, unit_id="A2-G001", status="completed", completed_at=datetime(2020, 1, 1)))
        db.commit()
        assert progress.check_achievements(db, 1, store) == ["first_lesson"]


def test_actually_studying_manual_lesson_records_real_completion(client, app):
    client.put("/api/progress/A0-G001", json={"status": "completed"})
    # Marking by hand doesn't advance slides to bypass normal completion checks.
    assert client.post("/api/lessons/A0-G001/complete").status_code == 409
    client.put("/api/progress/A0-G001", json={"current_step": 2000})
    result = client.post("/api/lessons/A0-G001/complete").json()
    assert result["xp_gained"] == 50 and "first_lesson" in result["new_achievements"]
    assert rows(client)["A0-G001"]["manual"] is False
    with app.state.sessionmaker() as db:
        assert db.scalar(select(ActivityDay.lessons_completed)) == 1


def test_level_moves_to_a2_and_undo_reopens_gap(client, app, store):
    client.post("/api/progress/mark-up-to", json={"level": "A1"})
    rec = client.get("/api/recommendations").json()
    assert rec["current_level"] == "A2" and rec["next_lesson"]["id"] == "A2-G001"
    assert rec["placement"] is None  # no fabricated placement exam
    with app.state.sessionmaker() as db:
        assert adaptive.current_level(db, 1, store) == "A2"
    assert client.put("/api/progress/A1-G003", json={"status": "not_started"}).status_code == 200
    undone = rows(client)["A1-G003"]
    assert undone["status"] == "not_started" and undone["completed_at"] is None
    assert client.get("/api/recommendations").json()["next_lesson"]["id"] == "A1-G003"
    with app.state.sessionmaker() as db:
        assert adaptive.current_level(db, 1, store) == "A1"
    client.put("/api/progress/A1-G003", json={"current_step": 1, "state": {"draft": "saved"}})
    assert rows(client)["A1-G003"]["status"] == "not_started"
    client.put("/api/progress/A1-G003", json={"status": "completed"})
    assert client.get("/api/recommendations").json()["current_level"] == "A2"


def test_placement_and_in_progress_agree_between_level_readers(client, app, store):
    client.get("/api/profile")
    with app.state.sessionmaker() as db:
        db.add(LearningProfile(user_id=1, preferences={"placement": {"level": "A1", "date": "2026-01-01"}}))
        db.commit()
    client.put("/api/progress/A1-G001", json={"current_step": 1})
    assert client.get("/api/recommendations").json()["next_lesson"]["id"] == "A1-G001"
    with app.state.sessionmaker() as db:
        assert adaptive.current_level(db, 1, store) == "A1"
    client.post("/api/progress/mark-up-to", json={"level": "B2"})
    rec = client.get("/api/recommendations").json()
    assert rec["current_level"] == "B2" and rec["next_lesson"] is None
    with app.state.sessionmaker() as db:
        assert adaptive.current_level(db, 1, store) == "B2"


@pytest.mark.parametrize("body", [{}, {"level": "C1"}, {"level": "A1", "unit_id": "A1-G001"},
                                  {"unit_id": "PLACEMENT-TEST"}, {"unit_id": "A0-SKILLS-PRACTICE"}])
def test_invalid_targets_do_not_write(client, body):
    assert client.post("/api/progress/mark-up-to", json=body).status_code == 422
    assert rows(client) == {}


def test_missing_lesson_and_invalid_status(client):
    assert client.post("/api/progress/mark-up-to", json={"unit_id": "missing"}).status_code == 404
    assert client.put("/api/progress/missing", json={"status": "completed"}).status_code == 404
    assert client.put("/api/progress/A0-G001", json={"status": "bad"}).status_code == 422
    assert client.put("/api/progress/A0-G001", json={"status": "completed", "current_step": 1}).status_code == 422
    assert rows(client) == {}
