"""End-to-end API behaviour with a fresh database."""


def steps(client, unit="A1-G011"):
    return client.get(f"/api/lessons/{unit}/steps").json()


def quiz_step(data, kind="mc"):
    return next(s for s in data["steps"] if s["type"] == "quiz" and any(i["kind"] == kind for i in s["items"]))


def test_dashboard_starts_empty(client):
    d = client.get("/api/dashboard").json()
    assert d["xp"]["total"] == 0 and d["lessons"]["completed"] == 0 and d["streak"] == 0
    assert d["recommendations"]["next_lesson"]["id"] == "A0-G001"


def test_quiz_submit_grades_and_awards_xp_once(client):
    data = steps(client)
    st = quiz_step(data)
    item = next(i for i in st["items"] if i["kind"] == "mc")
    r = client.post(f"/api/quizzes/{st['quiz_id']}/submit", json={"answers": {item["id"]: "B"}}).json()
    res = r["results"][item["id"]]
    assert res["verdict"] == "correct" and res["correct_option"] == "B" and r["xp_gained"] == 10
    r2 = client.post(f"/api/quizzes/{st['quiz_id']}/submit", json={"answers": {item["id"]: "B"}}).json()
    assert r2["xp_gained"] == 0  # duplicate submission gives no extra XP
    wrong = client.post(f"/api/quizzes/{st['quiz_id']}/submit", json={"answers": {item["id"]: "A"}}).json()
    assert wrong["results"][item["id"]]["verdict"] == "incorrect"
    assert client.get("/api/dashboard").json()["xp"]["total"] == 10
    assert client.get("/api/mistakes").json()["mistakes"][0]["item_id"] == item["id"]


def test_text_answer_match_and_self_assessment(client):
    data = steps(client)
    st = next(s for s in data["steps"] if s["type"] == "quiz" and s["title"].startswith("Level 3"))
    item = st["items"][0]  # L3.1 Turns off the lights... → Turn off
    ok = client.post(f"/api/quizzes/{st['quiz_id']}/submit", json={"answers": {item["id"]: "Turn off the lights when you leave."}}).json()
    assert ok["results"][item["id"]]["verdict"] == "correct"
    other = client.post(f"/api/quizzes/{st['quiz_id']}/submit", json={"answers": {item["id"]: "Switch off the lights as you go."}}).json()
    res = other["results"][item["id"]]
    assert res["verdict"] == "mismatch" and res["model_md"]
    sa = client.post(f"/api/attempts/{res['attempt_id']}/self-assess", json={"correct": True}).json()
    assert sa["result"]["self_correct"] is True


def test_cannot_submit_items_from_another_quiz(client):
    data = steps(client)
    q = [s for s in data["steps"] if s["type"] == "quiz"]
    r = client.post(f"/api/quizzes/{q[0]['quiz_id']}/submit", json={"answers": {q[1]["items"][0]["id"]: "x"}})
    assert r.status_code == 422


def test_progress_persists_and_completion_requires_reaching_end(client):
    data = steps(client)
    n = len(data["steps"])
    assert client.put("/api/progress/A1-G011", json={"current_step": 3, "state": {"draft": {"x": "y"}}}).status_code == 200
    again = steps(client)
    assert again["progress"]["current_step"] == 3 and again["progress"]["state"]["draft"] == {"x": "y"}
    assert client.post("/api/lessons/A1-G011/complete").status_code == 409
    client.put("/api/progress/A1-G011", json={"current_step": n - 1})
    r = client.post("/api/lessons/A1-G011/complete").json()
    assert r["xp_gained"] == 50 and r["status"] in ("completed", "review")
    assert client.post("/api/lessons/A1-G011/complete").json()["xp_gained"] == 0
    d = client.get("/api/dashboard").json()
    assert d["lessons"]["completed"] == 1
    assert any(a["key"] == "first_lesson" and a["earned_at"] for a in d["achievements"])


def test_score_is_computed_server_side(client):
    data = steps(client)
    st = quiz_step(data)
    answers = {i["id"]: "A" for i in st["items"] if i["kind"] == "mc"}
    client.post(f"/api/quizzes/{st['quiz_id']}/submit", json={"answers": answers})
    client.put("/api/progress/A1-G011", json={"current_step": len(data["steps"]) - 1})
    r = client.post("/api/lessons/A1-G011/complete").json()
    assert r["graded"] == len(answers) and r["score"] < 60 and r["status"] == "review"


def test_lesson_flashcards_use_fsrs_progress(client):
    """Lesson flashcards (card ids VOC-xx:...) are scheduled by FSRS in the shared vocabulary progress."""
    due = client.get("/api/vocabulary/due", params={"limit": 5}).json()
    card = due["cards"][0]
    r = client.post("/api/vocabulary/review", json={"card_id": card["id"], "grade": 4}).json()  # Good
    assert r["srs"]["state"] == "review" and r["srs"]["algorithm"].startswith("FSRS") and r["xp_gained"] == 2
    first_stability = r["srs"]["stability"]
    assert first_stability > 1
    r = client.post("/api/vocabulary/review", json={"card_id": card["id"], "grade": 1}).json()  # Again → relearning
    assert r["srs"]["state"] == "relearning" and r["srs"]["lapses"] == 1 and r["xp_gained"] == 0
    detail = client.get(f"/api/vocab/entries/{r['entry_id']}").json()  # same progress in the vocabulary module
    assert detail["progress"]["state"] == "relearning" and len(detail["history"]) == 2


def test_heartbeat_counts_time(client):
    client.put("/api/progress/A1-G011", json={"current_step": 0})
    assert client.post("/api/activity/heartbeat", json={"unit_id": "A1-G011"}).json()["counted_seconds"] == 15
    assert client.get("/api/dashboard").json()["today"]["minutes"] > 0


def test_reference_docs_and_traversal_blocked(client):
    r = client.get("/api/docs", params={"path": "06-GRAMMAR-REFERENCE/ALL-TENSES-COMPARISON.md"})
    assert r.status_code == 200 and "markdown" in r.json()
    for bad in ("../README.md", "/etc/passwd", "platform/README.md", "06-GRAMMAR-REFERENCE/../../x.md"):
        assert client.get("/api/docs", params={"path": bad}).status_code == 404


def test_validation_errors(client):
    assert client.post("/api/vocabulary/review", json={"card_id": "VOC-01:wake-up", "grade": 9}).status_code == 422
    assert client.put("/api/progress/A1-G011", json={"current_step": -1}).status_code == 422
    assert client.get("/api/lessons/NOPE").status_code == 404


def test_ai_disabled_without_key(client):
    st = client.get("/api/ai/status").json()
    assert st["configured"] is False and st["enabled"] is False
    r = client.post("/api/ai/tutor/chat", json={"unit_id": "A1-G011", "action": "explain_simply"})
    assert r.status_code == 503 and r.json()["code"] == "ai_disabled"
    # curriculum learning keeps working without AI
    assert client.get("/api/lessons/A1-G011/steps").status_code == 200


def test_placement_recommendation_uses_lower_of_total_and_parts(client, store):
    from app.services.progress import placement_parts

    parts = placement_parts(store)
    assert [p[0] for p in parts] == ["A0", "A1", "A2", "B1", "B2"]
    data = client.get("/api/lessons/PLACEMENT-TEST/steps").json()
    answers = {}
    for st in data["steps"]:
        for it in st.get("items") or []:
            label = it["label"]
            if it["kind"] == "mc" and label.isdigit() and int(label) <= 45:
                answers.setdefault(st["quiz_id"], {})[it["id"]] = None
    # answer A0–A2 parts correctly using the server's own grading feedback
    for quiz_id, items in answers.items():
        first = client.post(f"/api/quizzes/{quiz_id}/submit", json={"answers": {i: "A" for i in items}}).json()["results"]
        fix = {i: r["correct_option"] for i, r in first.items() if r["verdict"] != "correct"}
        if fix:
            client.post(f"/api/quizzes/{quiz_id}/submit", json={"answers": fix})
    client.put("/api/progress/PLACEMENT-TEST", json={"current_step": len(data["steps"]) - 1})
    client.post("/api/lessons/PLACEMENT-TEST/complete")
    rec = client.get("/api/recommendations").json()
    # 45 correct → total band A2 (45–59); first part under 11/15 is B1 → lower of the two is A2
    assert rec["placement"]["score"] == 45 and rec["placement"]["level"] == "A2"
    assert rec["next_lesson"]["id"] == "A2-G001"


def test_curriculum_quiz_retry_is_idempotent(client, app):
    from sqlalchemy import func, select
    from app.models import Attempt, TopicMastery
    data = client.get('/api/lessons/A1-G011/steps').json()
    quiz = next(s for s in data['steps'] if s['type'] == 'quiz' and s['items'][0]['id'] == 'A1-G011:L1.1')
    body = {'answers': {'A1-G011:L1.1': 'B'}, 'client_submission_id': 'curriculum-retry-1'}
    first = client.post(f"/api/quizzes/{quiz['quiz_id']}/submit", json=body).json()
    again = client.post(f"/api/quizzes/{quiz['quiz_id']}/submit", json=body).json()
    assert first['results'] == again['results'] and again['xp_gained'] == 0
    with app.state.sessionmaker() as db:
        assert db.scalar(select(func.count(Attempt.id))) == 1
        mastery = db.scalar(select(TopicMastery).where(TopicMastery.topic_id == 'A1-G011'))
        assert mastery.attempts == 1
    changed = {**body, 'answers': {'A1-G011:L1.1': 'A'}}
    assert client.post(f"/api/quizzes/{quiz['quiz_id']}/submit", json=changed).status_code == 409


def test_concurrent_first_profile_creation(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy.orm import Session
    from app.database import make_engine, init_db
    from app.models import User
    from app.services.progress import get_user
    engine = make_engine(f"sqlite:///{tmp_path / 'concurrent.db'}")
    init_db(engine)
    barrier = Barrier(4)
    class RacingSession(Session):
        waited = False
        def get(self, entity, ident, **kwargs):
            result = super().get(entity, ident, **kwargs)
            if entity is User and not self.waited:
                self.waited = True
                barrier.wait(timeout=5)
            return result
    def create(_):
        with RacingSession(engine) as db:
            return get_user(db).id
    with ThreadPoolExecutor(max_workers=4) as pool:
        assert list(pool.map(create, range(4))) == [1, 1, 1, 1]
    engine.dispose()


def test_stale_autosave_cannot_replace_newer_lesson_draft(client):
    client.put('/api/progress/A1-G011', json={'current_step': 4, 'state': {'savedAt': 200, 'drafts': {'q': 'new'}}})
    client.put('/api/progress/A1-G011', json={'current_step': 1, 'state': {'savedAt': 100, 'drafts': {'q': 'old'}}})
    progress = client.get('/api/lessons/A1-G011/steps').json()['progress']
    assert progress['current_step'] == 4
    assert progress['state']['drafts'] == {'q': 'new'}
