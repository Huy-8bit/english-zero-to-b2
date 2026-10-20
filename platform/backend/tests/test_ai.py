"""AI features with the deterministic FakeProvider (no network, no cost)."""
import io
import json
import uuid

import pytest
from fastapi.testclient import TestClient

from app.ai.errors import AIQuotaExceeded, AIUnavailable
from app.ai.fake import FakeProvider
from app.ai.settings import load_settings
from app.main import create_app


@pytest.fixture(scope="module")
def ai_app():
    settings = load_settings()
    settings.provider = "fake"
    settings.rate_limit_per_minute = 1000
    provider = FakeProvider()
    return create_app("sqlite:///:memory:", ai_settings=settings, ai_provider=provider)


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
    ai_app.state.ai.gateway._calls.clear()
    return TestClient(ai_app)


def gen(c, **kw):
    body = {"lesson_id": "A1-G001", "count": 5, "difficulty": "normal", "question_types": ["multiple_choice", "fill_blank", "translation_vi_en"]}
    body.update(kw)
    r = c.post("/api/ai/exercises/generate", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_status_reports_simulated_provider(c):
    st = c.get("/api/ai/status").json()
    assert st["enabled"] and st["simulated"] and st["models"]["tutor"]


def test_generated_set_is_validated_persisted_and_hides_keys(c):
    es = gen(c)
    assert len(es["questions"]) == 5
    assert es["generation"]["rejected"] >= 1  # the fake's deliberately broken question was dropped
    assert es["generation"]["blind_verified"] >= 1
    blob = json.dumps(es)
    assert "answer_key" not in blob and "explanation_vi" not in blob and "correct_answers" not in blob
    again = c.get(f"/api/exercises/{es['id']}").json()
    assert [q["id"] for q in again["questions"]] == [q["id"] for q in es["questions"]]  # refresh does not regenerate
    assert again["review"] is None
    assert c.get(f"/api/exercises/{es['id']}/review").status_code == 409


def test_submit_two_layer_grading_mistakes_mastery_and_idempotency(c, ai_app):
    es = gen(c)
    answers = {}
    for q in es["questions"]:
        if q["qtype"] == "multiple_choice":
            answers[q["id"]] = 0  # wrong (key is index 1)
        elif q["qtype"] == "fill_blank":
            answers[q["id"]] = q["question_text"].split("(")[1].split(")")[0] + "s"  # e.g. "watchs"/"goes" may be right or wrong
        else:
            answers[q["id"]] = "something unrelated"
    sid = str(uuid.uuid4())
    r = c.post(f"/api/exercises/{es['id']}/submit", json={"answers": answers, "client_submission_id": sid}).json()
    graders = {q["response"]["grader"] for q in r["questions"]}
    assert graders == {"deterministic", "ai"}
    mc = next(q for q in r["questions"] if q["qtype"] == "multiple_choice")
    assert mc["response"]["correctness"] == "incorrect" and mc["answer_key"]["correct_index"] == 1 and mc["explanation_vi"]
    tr = next(q for q in r["questions"] if q["qtype"] == "translation_vi_en")
    assert tr["response"]["grader"] == "ai" and tr["response"]["feedback"]["feedback_vi"]
    calls = len(ai_app.state.ai.gateway.provider.calls)
    again = c.post(f"/api/exercises/{es['id']}/submit", json={"answers": answers, "client_submission_id": sid}).json()
    assert again["submission_id"] == r["submission_id"]
    assert len(ai_app.state.ai.gateway.provider.calls) == calls  # retry did not call AI again
    m = c.get("/api/learning/mistakes").json()
    assert m["open_count"] >= 2 and any(x["source_type"] == "ai_exercise" for x in m["records"])
    topics = c.get("/api/learning/weaknesses").json()["topics"]
    assert any(t["topic_id"] == "A1-G001" for t in topics)


def test_api_failure_saves_nothing_and_can_retry(c, ai_app):
    es = gen(c, question_types=["translation_vi_en"], count=2)
    answers = {q["id"]: "She usually goes every day." for q in es["questions"]}
    ai_app.state.ai.gateway.provider.fail_next = AIUnavailable()
    r = c.post(f"/api/exercises/{es['id']}/submit", json={"answers": answers, "client_submission_id": "sub-fail-1"})
    assert r.status_code == 503 and r.json()["retryable"] is True and "Bài làm" in r.json()["message"]
    assert c.get(f"/api/exercises/{es['id']}/review").status_code == 409  # no fake score recorded
    ok = c.post(f"/api/exercises/{es['id']}/submit", json={"answers": answers, "client_submission_id": "sub-fail-1"})
    assert ok.status_code == 200
    ai_app.state.ai.gateway.provider.fail_next = AIQuotaExceeded()
    q = c.post("/api/ai/tutor/chat", json={"unit_id": "A1-G001", "action": "chat", "message": "Tại sao She goes?"})
    assert q.status_code == 503 and q.json()["code"] == "provider_quota"
    usage = c.get("/api/ai/usage").json()
    assert any(f["errors"] for f in usage["by_feature"])
    assert usage["totals"]["cost_usd"] > 0


def test_limits_daily_and_budget(c):
    c.put("/api/learning/settings", json={"daily_request_limit": 1})
    c.post("/api/ai/tutor/chat", json={"unit_id": "A1-G001", "action": "chat", "message": "hi"})
    r = c.post("/api/ai/tutor/chat", json={"unit_id": "A1-G001", "action": "chat", "message": "again"})
    assert r.status_code == 429 and r.json()["code"] == "daily_limit"
    c.put("/api/learning/settings", json={"daily_request_limit": 1000, "monthly_budget_usd": 0})
    r = c.post("/api/ai/tutor/chat", json={"unit_id": "A1-G001", "action": "chat", "message": "again"})
    assert r.status_code == 402 and r.json()["code"] == "budget_exceeded"
    c.put("/api/learning/settings", json={"monthly_budget_usd": 5, "ai_enabled": False})
    assert c.post("/api/ai/tutor/chat", json={"unit_id": "A1-G001", "action": "chat", "message": "x"}).json()["code"] == "ai_disabled"


def test_tutor_context_cache_and_history(c, ai_app):
    body = {"unit_id": "A1-G001", "action": "explain_simply", "step_index": 4}
    a = c.post("/api/ai/tutor/chat", json=body).json()
    n = len(ai_app.state.ai.gateway.provider.calls)
    b = c.post("/api/ai/tutor/chat", json=body).json()
    assert a["answer"] == b["answer"] and len(ai_app.state.ai.gateway.provider.calls) == n  # cached quick action
    assert len(c.get("/api/ai/tutor/history", params={"unit_id": "A1-G001"}).json()["messages"]) == 4
    r = c.post("/api/ai/tutor/chat", json={"unit_id": "A1-G001", "action": "explain_mistake", "item_id": "A1-G001:L1.1"})
    assert r.status_code == 422  # cannot ask before submitting


def test_retrieval_metadata_and_excludes_answer_files(ai_app):
    kb = ai_app.state.ai.kb
    hits = kb.search("present perfect since for", k=5)
    assert hits and all(not h.source_path.startswith("12-ANSWERS") for h in hits)
    meta = hits[0].meta()
    assert {"document_id", "lesson_id", "level", "module", "section_title", "source_path", "content_version"} <= set(meta)


def test_writing_feedback_highlights_and_history(c):
    text = "Yesterday I go to school with my friend. We played football."
    body = {"text": text, "prompt": {"title": "Last weekend", "prompt_en": "Write about yesterday"}, "mode": "minimal",
            "task_type": "paragraph", "level": "A2", "client_submission_id": "w-1-abcdef"}
    r = c.post("/api/ai/writing/evaluate", json=body).json()
    err = r["feedback"]["detected_errors"][0]
    assert err["span"] == [0, 14] and text[err["span"][0]:err["span"][1]] == "Yesterday I go"
    assert "went" in r["feedback"]["minimal_corrections"] and r["feedback"]["disclaimer_vi"]
    assert c.post("/api/ai/writing/evaluate", json=body).json()["id"] == r["id"]  # idempotent
    h = c.get("/api/writing/history").json()
    assert h["stats"]["error_categories"]["tense"] == 1
    assert c.delete(f"/api/writing/history/{r['id']}").status_code == 200


def test_speaking_flow_with_audio_upload(c):
    s = c.post("/api/ai/speaking/session", json={"mode": "guided", "topic": "weekend", "level": "A2"}).json()
    assert s["turns"][0]["role"] == "ai" and s["turns"][0]["audio_url"]
    audio = c.get(s["turns"][0]["audio_url"])
    assert audio.status_code == 200
    files = {"audio": ("a.webm", io.BytesIO(b"On Sunday she go to the market."), "audio/webm")}
    s2 = c.post(f"/api/ai/speaking/session/{s['id']}/answer", files=files, data={"seconds": "6", "client_turn_id": "turn-0001"}).json()
    user_turn = next(t for t in s2["turns"] if t["role"] == "user")
    assert user_turn["text"].startswith("On Sunday") and user_turn["feedback"]["grammar_feedback"][0]["correction"] == "she goes"
    assert user_turn["feedback"]["indicators"]["words_per_minute"] == 70
    bad = c.post(f"/api/ai/speaking/session/{s['id']}/answer", files={"audio": ("x.txt", io.BytesIO(b"x"), "text/plain")},
                 data={"client_turn_id": "turn-0002"})
    assert bad.status_code == 422
    end = c.post(f"/api/ai/speaking/session/{s['id']}/end").json()
    assert end["status"] == "ended" and "phát âm" in end["summary"]["pronunciation_note_vi"]
    rt = c.post("/api/ai/speaking/realtime-session", json={"level": "B1", "topic": "travel"}).json()
    assert rt["client_secret"].startswith("ek_") and "sk-" not in json.dumps(rt)
    assert c.delete(f"/api/speaking/sessions/{s['id']}").status_code == 200


def test_read_aloud_checks_pronunciation_word_by_word(c):
    s = c.post("/api/ai/speaking/session", json={"mode": "read_aloud", "topic": "", "level": "A1"}).json()
    target = s["turns"][0]["text"]
    files = {"audio": ("a.webm", io.BytesIO(target.encode()), "audio/webm")}
    s2 = c.post(f"/api/ai/speaking/session/{s['id']}/answer", files=files, data={"seconds": "4", "client_turn_id": "turn-ra-01"}).json()
    fb = next(t for t in s2["turns"] if t["role"] == "user")["feedback"]
    assert fb["match"]["word_match_percent"] == 100 and fb["pronunciation"]["score"] == 100
    assert all(w["status"] == "ok" for w in fb["pronunciation"]["words"])
    # a second sentence read badly: the next target is read with two words changed
    from app.ai.pronunciation import words_of

    nxt = s2["turns"][-1]["text"]
    words = words_of(nxt)  # real words only (sentences may contain "—", digits, quotes)
    bad = " ".join(["?" + words[0]] + ["zzz"] + words[2:])
    s3 = c.post(f"/api/ai/speaking/session/{s['id']}/answer", files={"audio": ("b.webm", io.BytesIO(bad.encode()), "audio/webm")},
                data={"seconds": "4", "client_turn_id": "turn-ra-02"}).json()
    p = [t for t in s3["turns"] if t["role"] == "user"][-1]["feedback"]["pronunciation"]
    st = {w["status"] for w in p["words"][:2]}
    assert st == {"unclear", "different"} and p["score"] < 100 and p["words"][1]["heard"] == "zzz"
    end = c.post(f"/api/ai/speaking/session/{s['id']}/end").json()
    assert end["summary"]["average_pronunciation"] is not None and end["summary"]["words_to_practise"]


def test_pronunciation_alignment_tokenises_both_sides_alike():
    from app.ai.pronunciation import align

    ws = align("It’s a well-known café, isn't it?", [("it's", 0.99), ("a", 0.99), ("well-known", 0.99), ("cafe", 0.99), ("isn't", 0.99), ("it", 0.99)])
    assert [w["status"] for w in ws] == ["ok", "ok", "ok", "ok", "different", "ok", "ok"]  # only café ≠ cafe
    assert all(w["status"] == "ok" for w in align("The museum opens at 9 a.m.", [("the", .99), ("museum", .99), ("opens", .99), ("at", .99), ("nine", .99), ("am", .99)]))
    assert all(w["status"] == "ok" for w in align("The train leaves at 8:15.", [("the", .99), ("train", .99), ("leaves", .99), ("at", .99), ("815", .99)]))


def test_pronunciation_assess_explains_and_tracks_progress(c, ai_app):
    ref = "I think this is the third thing."
    send = lambda said: c.post("/api/pronunciation/assess", files={"audio": ("a.webm", io.BytesIO(said.encode()), "audio/webm")},
                               data={"reference": ref, "source": "practice", "seconds": "3"})
    r = send("I tink ?this is the tird thing").json()
    by = {w["word"]: w for w in r["words"]}
    assert by["think"]["status"] == "different" and by["think"]["heard"] == "tink"
    assert by["this"]["status"] == "unclear" and by["third"]["status"] == "different" and by["thing"]["status"] == "ok"
    assert r["score"] == round(100 * 4 / 7) and r["counts"]["different"] == 2
    assert any("/θ/" in t for t in by["think"]["tips_vi"])  # built-in tip for the "th" sound
    assert by["think"]["ipa"] and "θ" in by["think"]["ipa"]  # dictionary IPA, never AI IPA
    assert by["think"]["explain"]["practice"]  # optional AI explanation of the flagged words only
    r2 = send("I think this is the third thing").json()
    assert r2["score"] == 100 and r2["previous_score"] == r["score"]  # progress on the same sentence
    sm = c.get("/api/pronunciation/summary").json()
    assert sm["attempts"] == 2 and {w["word"] for w in sm["hard_words"]} >= {"think", "third"}
    bad = c.post("/api/pronunciation/assess", files={"audio": ("a.webm", io.BytesIO(b"x"), "audio/webm")},
                 data={"reference": "   ", "source": "practice"})
    assert bad.status_code == 422


def test_tts_endpoint_uses_ai_voice_and_caches(c, ai_app):
    calls = len(ai_app.state.ai.gateway.provider.calls)
    a = c.post("/api/tts", json={"text": "Nice to meet you.", "accent": "uk"}).json()
    b = c.post("/api/tts", json={"text": "Nice  to meet you.", "accent": "uk"}).json()
    assert a["url"] == b["url"] and a["ai_voice"] and c.get(a["url"]).status_code == 200
    assert len(ai_app.state.ai.gateway.provider.calls) == calls + 1  # same text → generated once
    slow = c.post("/api/tts", json={"text": "Nice to meet you.", "accent": "uk", "slow": True}).json()
    assert slow["url"] != a["url"]
    assert c.post("/api/tts", json={"text": "x" * 801}).status_code == 422


def test_listening_transcript_hidden_until_submit_and_audio_cached(c, ai_app):
    r = c.post("/api/ai/listening/generate", json={"level": "A2", "topic": "weekend", "mode": "test", "question_count": 3}).json()
    assert r["transcript"] is None and r["audio_url"].endswith(".mp3")
    assert c.get(f"/api/listening/{r['id']}", params={"reveal_transcript": True}).json()["transcript"] is None  # test mode
    calls = len(ai_app.state.ai.gateway.provider.calls)
    for _ in range(3):
        assert c.get(r["audio_url"]).status_code == 200  # replay = no new TTS
    assert len(ai_app.state.ai.gateway.provider.calls) == calls
    answers = {q["id"]: 1 for q in r["questions"]}
    done = c.post(f"/api/listening/{r['id']}/submit", json={"answers": answers, "client_submission_id": "listen-sub-1"}).json()
    assert done["transcript"] and done["vocabulary"] and done["review"]["questions"][0]["evidence_quote"]


def test_reading_evidence_and_analytics(c):
    r = c.post("/api/ai/reading/generate", json={"level": "B1", "topic": "online learning", "question_count": 3}).json()
    assert r["meta"]["passage"]
    answers = {q["id"]: 0 for q in r["questions"]}
    rev = c.post(f"/api/exercises/{r['id']}/submit", json={"answers": answers, "times_ms": {k: 12000 for k in answers},
                                                          "client_submission_id": "read-sub-1"}).json()
    q0 = rev["questions"][0]
    assert q0["evidence_quote"] in r["meta"]["passage"] and q0["reading_strategy_vi"]
    a = c.get("/api/reading/analytics").json()
    assert a["total"] == 3 and a["by_type"][0]["avg_seconds"] == 12.0


def test_placement_adaptive_flow_and_recommendation(c):
    s = c.post("/api/placement/start", json={"include_writing": True}).json()
    sid = s["session_id"]
    steps = 0
    cur = s
    while not cur.get("done") and steps < 60:
        q = cur["question"]
        if q["kind"] == "long":
            cur = c.post(f"/api/placement/{sid}/answer", json={"item_id": "writing", "answer": "I get up at six. Yesterday I went to the beach."}).json()
        else:
            cur = c.post(f"/api/placement/{sid}/answer", json={"item_id": q["id"], "answer": "A"}).json()
        steps += 1
    assert cur["done"] and cur["result"]["skills"]["speaking"] is None
    assert cur["result"]["skills"]["grammar"] and "không phải chứng nhận" in cur["result"]["disclaimer_vi"]
    rec = c.get("/api/recommendations").json()
    assert rec["placement"]["level"] == cur["result"]["overall"]


def test_curriculum_open_answer_ai_grading_and_daily_plan(c):
    data = c.get("/api/lessons/A1-G011/steps").json()
    st = next(s for s in data["steps"] if s["type"] == "quiz" and s["title"].startswith("Level 3"))
    item = st["items"][1]
    res = c.post(f"/api/quizzes/{st['quiz_id']}/submit", json={"answers": {item["id"]: "Please do not park here, thanks."}}).json()
    att = res["results"][item["id"]]
    assert att["verdict"] == "mismatch"
    g = c.post(f"/api/ai/grade-attempt/{att['attempt_id']}").json()
    assert g["correctness"] in ("correct", "incorrect", "partial") and g["feedback_vi"]
    assert c.post(f"/api/ai/grade-attempt/{att['attempt_id']}").json() == g  # stored, not re-billed
    plan = c.get("/api/learning/recommendations").json()["plan"]
    assert any(p["recommendation_type"] == "vocabulary_review" for p in plan)
    fu = c.post("/api/ai/feedback", json={"target_type": "attempt", "target_id": str(att["attempt_id"]), "action": "why_wrong"}).json()
    assert fu["content"]
    assert c.get("/api/ai/feedback", params={"target_type": "attempt", "target_id": str(att["attempt_id"])}).json()["messages"]


def test_practice_my_mistakes_creates_new_questions(c):
    es = gen(c, question_types=["multiple_choice"], count=3)
    c.post(f"/api/exercises/{es['id']}/submit", json={"answers": {q["id"]: 0 for q in es["questions"]}, "client_submission_id": "mist-sub-1"})
    r = c.post("/api/learning/review-session", json={"scope": "mistakes", "count": 3})
    assert r.status_code == 200, r.text
    new = r.json()
    old_texts = {q["question_text"] for q in es["questions"]}
    assert not old_texts & {q["question_text"] for q in new["questions"]}


def test_auth_token_protects_api(monkeypatch, ai_app):
    from app import config

    monkeypatch.setattr(config, "APP_ACCESS_TOKEN", "s3cret-token")
    tc = TestClient(ai_app)
    assert tc.get("/api/dashboard").status_code == 401
    assert tc.get("/api/health").status_code == 200
    assert tc.post("/api/auth/login", json={"token": "wrong"}).status_code == 401
    assert tc.post("/api/auth/login", json={"token": "s3cret-token"}).status_code == 200
    assert tc.get("/api/dashboard").status_code == 200  # cookie session
    assert TestClient(ai_app).get("/api/ai/status", headers={"Authorization": "Bearer s3cret-token"}).status_code == 200


def test_file_sqlite_no_lock_between_request_and_usage_log(tmp_path):
    """Regression: usage logging must not wait on the request's SQLite write lock (file DB, WAL)."""
    import time

    settings = load_settings()
    settings.provider = "fake"
    settings.rate_limit_per_minute = 1000
    app = create_app(f"sqlite:///{tmp_path / 'lock.db'}", ai_settings=settings, ai_provider=FakeProvider())
    tc = TestClient(app)
    t0 = time.monotonic()
    s = tc.post("/api/ai/speaking/session", json={"mode": "guided", "topic": "food", "level": "A2"})
    t = tc.post("/api/ai/tutor/chat", json={"unit_id": "A1-G001", "action": "chat", "message": "Tại sao She goes?"})
    assert s.status_code == 200 and t.status_code == 200
    assert time.monotonic() - t0 < 3
    usage = tc.get("/api/ai/usage").json()
    assert usage["totals"]["requests"] >= 3  # question + TTS + tutor were all logged


def test_retry_returns_original_attempt_and_rejects_cross_set_id(c):
    es = gen(c, count=2, question_types=["multiple_choice"])
    def submit(client_id, answer, set_id=es["id"]):
        return c.post(f"/api/exercises/{set_id}/submit", json={"answers": {q["id"]: answer for q in es["questions"]},
                                                              "client_submission_id": client_id})
    first = submit("original-attempt", 0).json()
    second = submit("second-attempt", 1).json()
    assert first["score"] == 0 and second["score"] == 2
    retry = submit("original-attempt", 0).json()
    assert retry["submission_id"] == first["submission_id"] and retry["score"] == 0
    other = gen(c, count=2, question_types=["multiple_choice"])
    assert submit("original-attempt", 0, other["id"]).status_code == 422


@pytest.mark.parametrize("invalid", ["missing", "duplicate", "undecided"])
def test_incomplete_ai_grading_never_records_a_score(c, ai_app, monkeypatch, invalid):
    from app.ai.schemas import GradingBatch
    es = gen(c, count=2, question_types=["translation_vi_en"])
    provider = ai_app.state.ai.gateway.provider
    original = provider.structured
    def malformed(**kwargs):
        value, usage = original(**kwargs)
        if kwargs["schema"] is GradingBatch:
            if invalid == "missing":
                value.results.pop()
            elif invalid == "duplicate":
                value.results[-1] = value.results[0]
            else:
                value.results[0].correctness = "needs_review"
        return value, usage
    monkeypatch.setattr(provider, "structured", malformed)
    body = {"answers": {q["id"]: "Another possible phrasing." for q in es["questions"]}, "client_submission_id": "invalid-grading"}
    response = c.post(f"/api/exercises/{es['id']}/submit", json=body)
    assert response.status_code == 502 and response.json()["code"] == "invalid_output"
    assert c.get(f"/api/exercises/{es['id']}/review").status_code == 409
    assert c.get("/api/learning/mistakes").json()["open_count"] == 0
    monkeypatch.setattr(provider, "structured", original)
    assert c.post(f"/api/exercises/{es['id']}/submit", json=body).status_code == 200


def test_listening_question_context_never_leaks_transcript(c, ai_app):
    from sqlalchemy import select
    from app.models import ExerciseQuestion
    es = c.post("/api/ai/listening/generate", json={"level": "A2", "topic": "weekend", "mode": "test", "question_count": 3}).json()
    with ai_app.state.sessionmaker() as db:
        question = db.scalar(select(ExerciseQuestion).where(ExerciseQuestion.set_id == es["id"]))
        question.extra = {**question.extra, "context_passage": "SECRET transcript copied by the model"}
        db.commit()
    for path in (f"/api/listening/{es['id']}", f"/api/exercises/{es['id']}"):
        payload = c.get(path).json()
        assert "SECRET" not in json.dumps(payload)
        assert all(q["context_passage"] is None for q in payload["questions"])


def test_mock_and_live_audio_use_different_cache_keys():
    from app.ai.media import tts_name
    assert tts_name("model", "voice", "Hello", provider="fake") != tts_name("model", "voice", "Hello", provider="openai")


def test_cached_tutor_obeys_disable_switch(c):
    body = {"unit_id": "A1-G001", "action": "explain_simply", "step_index": 4}
    assert c.post("/api/ai/tutor/chat", json=body).status_code == 200
    c.put("/api/learning/settings", json={"ai_enabled": False})
    response = c.post("/api/ai/tutor/chat", json=body)
    assert response.status_code == 503 and response.json()["code"] == "ai_disabled"


def test_user_limits_cannot_exceed_deployment_caps(c, ai_app):
    c.put("/api/learning/settings", json={"daily_request_limit": 5000, "monthly_budget_usd": 1000})
    limits = c.get("/api/ai/limits").json()["limits"]
    assert limits["daily_request_limit"] == ai_app.state.ai.settings.daily_request_limit
    assert limits["monthly_budget_usd"] == ai_app.state.ai.settings.monthly_budget_usd


def test_unknown_model_requires_pricing_before_billable_request(c, ai_app, monkeypatch):
    monkeypatch.setitem(ai_app.state.ai.settings.models, "tutor", "custom-unpriced")
    response = c.post("/api/ai/tutor/chat", json={"unit_id": "A1-G001", "action": "chat", "message": "Why?"})
    assert response.status_code == 503 and response.json()["code"] == "config_error"


def test_live_transcription_rejects_overlong_audio_before_provider(c, ai_app, monkeypatch):
    from tests.test_audio_validation import wav
    monkeypatch.setattr(ai_app.state.ai.settings, "provider", "openai")
    monkeypatch.setattr(ai_app.state.ai.settings, "api_key", "test-placeholder")
    monkeypatch.setattr(ai_app.state.ai.settings, "max_audio_seconds", 1)
    calls = len(ai_app.state.ai.gateway.provider.calls)
    response = c.post("/api/ai/speaking/transcribe", files={"audio": ("a.wav", wav(3), "audio/wav")}, data={"seconds": "0.1"})
    assert response.status_code == 422
    assert len(ai_app.state.ai.gateway.provider.calls) == calls


def test_writing_submission_id_cannot_return_feedback_for_different_text(c):
    body = {"text": "Yesterday I go to school with my friend.", "prompt": {"title": "Last weekend"}, "mode": "minimal",
            "task_type": "paragraph", "level": "A2", "client_submission_id": "writing-conflict"}
    assert c.post('/api/ai/writing/evaluate', json=body).status_code == 200
    assert c.post('/api/ai/writing/evaluate', json={**body, 'text': 'Today I work from home.'}).status_code == 422


@pytest.mark.parametrize('kind', ['reading', 'listening'])
def test_studio_respects_requested_question_count(c, kind):
    response = c.post(f'/api/ai/{kind}/generate', json={'level': 'A2', 'topic': 'weekend', 'question_count': 8})
    assert response.status_code == 200, response.text
    assert len(response.json()['questions']) == 8
