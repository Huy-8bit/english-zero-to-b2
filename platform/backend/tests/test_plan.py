"""Daily 4-hour plan and smart review."""
from datetime import timedelta

from app.models import MistakeRecord, StudyLog, utcnow


def test_plan_has_interleaved_blocks_breaks_and_tracks_progress(client, app):
    client.put("/api/profile", json={"daily_goal_minutes": 240})
    p = client.get("/api/plan/today").json()
    assert p["target_minutes"] == 240 and [b["id"] for b in p["blocks"]] == ["warmup", "gaps", "lesson1", "write", "vocab_new", "lesson2", "speak", "input", "final"]
    assert sum(b["minutes"] for b in p["blocks"]) == 240
    breaks = [t for t in p["timeline"] if t["type"] == "break"]
    assert len(breaks) == 8 and sum(1 for b in breaks if b["long"]) == 1  # one long break after ~2 hours
    output = sum(b["minutes"] for b in p["blocks"] if b["category"] == "output")
    assert output >= 45 and {b["action"]["link"] for b in p["blocks"] if b["category"] == "output"} == {"/writing-daily", "/speaking-studio"}
    cats = [b["category"] for b in p["blocks"]]
    assert all(cats[i] != cats[i + 1] for i in range(len(cats) - 1))  # never two blocks of the same kind in a row
    assert p["blocks"][2]["action"]["link"].startswith("/learn/")
    from app.services.progress import today
    with app.state.sessionmaker() as db:  # 45 minutes on a grammar lesson + 10 on vocabulary
        db.add(StudyLog(user_id=1, day=today(), activity_key="A0-G001", kind="lesson", seconds=45 * 60, items_answered=10, items_correct=9,
                        cards_reviewed=0, words_learned=0, completed=True, score=90, source="live"))
        db.add(StudyLog(user_id=1, day=today(), activity_key="vocab", kind="module", seconds=600, items_answered=20, items_correct=18,
                        cards_reviewed=12, words_learned=0, completed=False, source="live"))
        db.commit()
    p = client.get("/api/plan/today").json()
    blocks = {b["id"]: b for b in p["blocks"]}
    assert blocks["lesson1"]["status"] == "done" and blocks["warmup"]["done_minutes"] == 10 and p["minutes_today"] == 55
    assert p["current_block"] == "warmup"


def test_smaller_goal_keeps_core_blocks(client):
    client.put("/api/profile", json={"daily_goal_minutes": 90})
    ids = [b["id"] for b in client.get("/api/plan/today").json()["blocks"]]
    assert ids == ["warmup", "gaps", "lesson1"]


def test_smart_review_collects_gaps_and_checks_corrections(client, app):
    client.get("/api/profile")
    st = client.get("/api/lessons/A1-G011/steps").json()
    quiz = next(s for s in st["steps"] if s["type"] == "quiz")
    client.post(f"/api/quizzes/{quiz['quiz_id']}/submit", json={"answers": {quiz["items"][0]["id"]: "A"}})  # wrong
    with app.state.sessionmaker() as db:
        db.add(MistakeRecord(user_id=1, key="writing:1:0", source_type="writing", source_ref="1", question_text="Writing: My weekend",
                             student_answer="She go to school yesterday.", corrected_answer="She went to school yesterday.", error_type="tense",
                             explanation="Quá khứ đơn: go → went.", frequency=2, correct_streak=0, review_status="new",
                             first_seen=utcnow() - timedelta(days=2), last_seen=utcnow() - timedelta(days=2)))
        db.commit()
    d = client.get("/api/review/smart").json()
    sec = {s["id"]: s["count"] for s in d["sections"]}
    assert sec["curriculum"] >= 1 and sec["corrections"] == 1 and d["curriculum_items"][0]["item"]["id"] == quiz["items"][0]["id"]
    c = d["corrections"][0]
    assert "went" not in str(c)  # the correction is not revealed before answering
    bad = client.post(f"/api/review/corrections/{c['id']}", json={"answer": "She goes to school yesterday."}).json()
    assert not bad["correct"] and bad["expected"] == "She went to school yesterday."
    ok = client.post(f"/api/review/corrections/{c['id']}", json={"answer": "she went to school yesterday"}).json()
    assert ok["correct"] and ok["status"] == "reviewing"
    ok2 = client.post(f"/api/review/corrections/{c['id']}", json={"answer": "She went to school yesterday."}).json()
    assert ok2["status"] == "mastered"
    assert client.get("/api/review/smart").json()["sections"][1]["count"] == 0
    p = client.get("/api/plan/today").json()
    assert any(q["id"] == "fix" for q in p["quests"])


def test_vocab_gaps_session_targets_wrong_and_due_words(client):
    s = client.post("/api/vocab/sessions", json={"kind": "flashcards", "size": 3}).json()
    for it in s["items"]:
        client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "rating": 1})
    g = client.post("/api/vocab/sessions", json={"kind": "gaps"}).json()
    assert g["items"] and g["title_vi"] == "Ôn lỗ hổng từ vựng"
