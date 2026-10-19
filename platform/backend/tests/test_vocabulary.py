"""Vocabulary module: data integrity, import idempotency, learning engine (FSRS), notebook, integration, AI (fake)."""
import gzip
import json
import re
from collections import Counter
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.ai.errors import AIUnavailable
from app.ai.fake import FakeProvider
from app.ai.settings import load_settings
from app.main import create_app
from app.models import VocabEntry, VocabProgress, VocabReviewLog, VocabSense
from app.vocabulary import grading, lexicon
from app.vocabulary.lexicon import DATA_FILE, LexiconError, validate

LEVELS = {"A1", "A2", "B1", "B2", "C1"}


# ============================================================ data
@pytest.fixture(scope="module")
def entries():
    return lexicon.dataset()[1]


def test_lexicon_size_levels_and_ids(entries):
    ids = [e["id"] for e in entries]
    assert len(ids) == len(set(ids)), "duplicate primary ids"
    lemmas = [e for e in entries if e["kind"] in ("word", "phrasal_verb")]
    assert len({lexicon.norm(e["lemma"]) for e in lemmas}) >= 3000  # unique lemmas, variants not counted twice
    assert {e["cefr"] for e in entries} <= LEVELS
    for e in entries:
        assert re.fullmatch(r"[a-z0-9_\-.]+", e["id"]) and e["lemma"].strip()
        assert e["senses"] and all(s["meaning_vi"].strip() for s in e["senses"])
        assert all(s["id"].startswith(e["id"] + "#") for s in e["senses"])  # consistent word–sense relationship
        assert e["status"] in ("curriculum", "sourced")
        assert e["ipa_status"] in ("dictionary", "dictionary+curriculum", "composed", "missing")
        assert not (e["ipa_status"] == "missing" and e["ipa_uk"])  # no unverified IPA is published as verified


def test_every_curriculum_card_maps_to_one_entry(entries, store):
    cards = {c["id"] for c in store.cards()}
    mapped = Counter(lid for e in entries for lid in e["legacy_ids"])
    assert set(mapped) == cards and max(mapped.values()) == 1


def test_lesson_associations_point_to_real_units(entries, store):
    units = {u.id for u in store.unit_list}
    assert all(u in units for e in entries for u in e["units"])


def test_examples_contain_the_word(entries):
    bad = 0
    for e in entries[:1500]:
        forms = [e["lemma"], *e["forms"], *e["variants"]]
        for x in e["examples"]:
            if x["source"] in ("tatoeba", "wiktionary") and not grading.contains_word(x["en"], forms):
                bad += 1
    assert bad == 0


def test_validation_rejects_broken_data(entries):
    e = json.loads(json.dumps(entries[0]))
    with pytest.raises(LexiconError):
        validate((e, e))
    e2 = json.loads(json.dumps(entries[1]))
    e2["senses"][0]["meaning_vi"] = " "
    with pytest.raises(LexiconError):
        validate((e2,))
    e3 = json.loads(json.dumps(entries[2]))
    e3["cefr"] = "Z9"
    with pytest.raises(LexiconError):
        validate((e3,))


def test_import_is_idempotent(client, app):
    with app.state.sessionmaker() as db:
        first = lexicon.import_dataset(db)
        n1 = db.scalar(select(func.count(VocabEntry.id)))
        s1 = db.scalar(select(func.count(VocabSense.id)))
        second = lexicon.import_dataset(db)
        assert db.scalar(select(func.count(VocabEntry.id))) == n1 and db.scalar(select(func.count(VocabSense.id))) == s1
        assert second["inserted"] == 0 and second["updated"] == first["entries"]


# ============================================================ grading
@pytest.mark.parametrize("answer,verdict", [
    ("achieve", "correct"), ("Achieve.", "correct"), ("to achieve", "acceptable"), ("acheive", "spelling"),
    ("achieved", "wrong_form"), ("achievement", "wrong_form"), ("borrow", "wrong_meaning"), ("xyzzy", "incorrect"), ("", "incorrect"),
])
def test_typed_answer_verdicts(answer, verdict):
    other = (lambda t: ("borrow", "mượn") if t == "borrow" else None)
    g = grading.grade_typed(answer, target="achieve", forms=["achieves", "achieved", "achieving"], family=["achievement"], other_entry=other)
    assert g["verdict"] == verdict


def test_alternatives_and_spelling_variants():
    assert set(grading.alternatives("catch / miss the bus")) == {"catch the bus", "miss the bus"}
    assert "brush teeth" in grading.alternatives("brush (teeth)") and "brush" in grading.alternatives("brush (teeth)")
    assert grading.grade_typed("color", target="colour")["verdict"] == "acceptable"
    assert grading.grade_typed("organize", target="organise")["verdict"] == "acceptable"


# ============================================================ learning engine (no AI)
def start(c, kind, **kw):
    r = c.post("/api/vocab/sessions", json={"kind": kind, **kw})
    assert r.status_code == 200, r.text
    return r.json()


def answer_item(c, s, it, *, right=True, store_answers=None):
    """Answer like a learner. For deterministic items the test peeks at the server-side key through the DB."""
    t = it["type"]
    body = {"item_id": it["id"], "duration_ms": 4000}
    if t == "learn":
        pass
    elif t == "flashcard":
        body["rating"] = 3 if right else 1
    elif t in ("mc_meaning", "mc_word", "cloze", "collocation", "confusable", "listen_choose"):
        key = store_answers[it["id"]]["answer"]
        body["choice"] = key if right else (key + 1) % len(it["options"])
    elif t in ("type_word", "dictation"):
        body["answer"] = store_answers[it["id"]]["target"] if right else "qqqqqq"
    elif t == "builder":
        body["tokens"] = store_answers[it["id"]]["sentence"].split() if right else list(reversed(it["tokens"]))
    r = c.post(f"/api/vocab/sessions/{s['id']}/answer", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def keys(app, sid):
    """Server-side answer keys (+ the item's word as "_entry") — tests only."""
    from app.models import VocabSession

    with app.state.sessionmaker() as db:
        return {it["id"]: {**it["private"], "_entry": it["entry_id"]} for it in db.get(VocabSession, sid).items}


def eid(k, it):
    return k[it["id"]]["_entry"]


def shift_days(app, entry_id, days):
    """Pretend `days` passed since the last review (moves FSRS dates back)."""
    with app.state.sessionmaker() as db:
        p = db.scalar(select(VocabProgress).where(VocabProgress.entry_id == entry_id))
        d = timedelta(days=days)
        f = dict(p.fsrs)
        for k in ("due", "last_review"):
            if f.get(k):
                f[k] = (datetime.fromisoformat(f[k]) - d).isoformat()
        p.fsrs, p.due, p.last_review = f, p.due - d, p.last_review - d
        db.commit()


def test_session_never_sends_answer_keys(client, app):
    s = start(client, "daily")
    blob = json.dumps(s)
    assert s["items"] and "private" not in blob and '"answer"' not in blob and '"target"' not in blob
    k = keys(app, s["id"])
    def strings(x):
        if isinstance(x, dict):
            return [v for y in x.values() for v in strings(y)]
        if isinstance(x, list):
            return [v for y in x for v in strings(y)]
        return [x] if isinstance(x, str) else []
    for it in s["items"]:
        if it["type"] in ("type_word", "dictation"):
            target = k[it["id"]]["target"].lower()
            assert all(v.lower() != target for v in strings(it)) and "entry_id" not in it
            for field in ("sentence", "phrase", "example"):
                assert not grading.contains_word(str(it.get(field) or ""), [target])


def test_learn_new_words_full_cycle(client, app):
    """E2E-equivalent API flow: A1 Daily Routine → learn → recall → refresh → due later → review → stats."""
    s = start(client, "learn", topic="daily-routine", level="A1", size=5)
    k = keys(app, s["id"])
    words = {eid(k, it) for it in s["items"]}
    assert len(words) == 5 and s["items"][0]["type"] == "learn"
    types = Counter(it["type"] for it in s["items"])
    assert types["learn"] == 5 and types["type_word"] == 5 and types["mc_meaning"] + types["mc_word"] == 5
    wrong_entry = eid(k, s["items"][-1])
    for i, it in enumerate(s["items"]):
        if i == 3:  # refresh mid-session: the server has every answer, the cursor resumes
            again = client.get(f"/api/vocab/sessions/{s['id']}").json()
            assert again["cursor"] == 3 and len(again["results"]) == 3
        out = answer_item(client, s, it, right=eid(k, it) != wrong_entry or it["type"] != "type_word", store_answers=k)
        assert out["entry_id"] == eid(k, it)
        if it["type"] == "type_word" and eid(k, it) == wrong_entry:
            assert out["verdict"] == "incorrect" and out["retry_added"]
    s2 = client.get(f"/api/vocab/sessions/{s['id']}").json()
    k2 = keys(app, s["id"])
    retry = [it for it in s2["items"] if it["round"] == 2]
    assert len(retry) == 1 and eid(k2, retry[0]) == wrong_entry  # difficult word retry
    answer_item(client, s2, retry[0], right=True, store_answers=k2)
    summary = client.post(f"/api/vocab/sessions/{s['id']}/finish").json()
    assert set(summary["recalled"]) == words and wrong_entry in summary["difficult"]
    assert summary["scheduled"] == 6 and summary["mistakes"][0]["entry_id"] == wrong_entry
    with app.state.sessionmaker() as db:
        rows = {p.entry_id: p for p in db.scalars(select(VocabProgress).where(VocabProgress.entry_id.in_(words)))}
        assert all(p.state != "new" and p.fsrs for p in rows.values())
        assert rows[wrong_entry].incorrect_count == 1
        logs = db.scalars(select(VocabReviewLog).where(VocabReviewLog.rating.is_not(None))).all()
        assert len(logs) == 6  # one FSRS review per word per round, not one per item
    st = client.get("/api/vocab/stats").json()["counts"]
    assert st["encountered"] == 5 and st["learned"] == 5 and st["answered_correctly"] == 5
    assert st.get("recalled_after_delay", 0) == 0 and st.get("used_correctly", 0) == 0  # never conflated
    # nothing due right now → after 30 days every word is due and appears in "Review Today's Words"
    assert client.get("/api/vocab/plan").json()["due_now"] == 0
    for w in words:
        shift_days(app, w, 30)
    pl = client.get("/api/vocab/plan").json()
    assert pl["due_now"] == 5 and pl["tasks"][0]["key"] == "review"
    r = start(client, "review")
    kr = keys(app, r["id"])
    assert {eid(kr, it) for it in r["items"]} == words and all(it["scheduled"] for it in r["items"])
    for it in r["items"]:
        answer_item(client, r, it, right=True, store_answers=kr)
    client.post(f"/api/vocab/sessions/{r['id']}/finish")
    st2 = client.get("/api/vocab/stats").json()
    assert st2["counts"]["recalled_after_delay"] == 5 and st2["counts"].get("due", 0) == 0
    assert st2["estimated_retention"] is not None and st2["algorithm"].startswith("FSRS")


def test_flashcard_ratings_schedule_and_answers_are_idempotent(client, app):
    s = start(client, "flashcards", size=4)
    it = s["items"][0]
    assert it["type"] == "flashcard" and it["meaning_vi"]
    a = client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "rating": 4}).json()
    b = client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "rating": 1}).json()  # double submit
    assert a == b and a["schedule"]["rating_name"] == "easy"
    d = client.get(f"/api/vocab/entries/{it['entry_id']}").json()
    assert d["progress"]["state"] == "review" and len(d["history"]) == 1
    assert set(d["preview"]) == {"again", "hard", "good", "easy"}
    bad = client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": s["items"][1]["id"]})
    assert bad.status_code == 422


def test_not_due_practice_does_not_move_schedule(client, app):
    s = start(client, "flashcards", size=3)
    it = s["items"][0]
    client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "rating": 3})
    due1 = client.get(f"/api/vocab/entries/{it['entry_id']}").json()["progress"]["due"]
    p = start(client, "context", entry_ids=[it["entry_id"]], size=3)
    k = keys(app, p["id"])
    mine = [x for x in p["items"] if eid(k, x) == it["entry_id"]]
    assert mine and not mine[0]["scheduled"]
    answer_item(client, p, mine[0], right=False, store_answers=k)
    d = client.get(f"/api/vocab/entries/{it['entry_id']}").json()
    assert d["progress"]["due"] == due1 and d["my_mistakes"]  # mistake logged, schedule unchanged


def test_type_answer_feedback_types(client, app):
    s = start(client, "type", level="B1", size=10)
    ks = keys(app, s["id"])
    it = next(x for x in s["items"] if re.fullmatch(r"[a-z]{5,}", ks[x["id"]]["target"]))
    k = ks[it["id"]]
    target = k["target"]
    typo = target[:-2] + target[-1] + target[-2] if len(target) > 4 else target + "x"
    out = client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "answer": typo}).json()
    assert out["verdict"] in ("spelling", "correct", "acceptable") and out["expected"]


def test_notebook_collections_and_filters(client):
    e = client.get("/api/vocab/entries", params={"q": "achieve"}).json()["items"][0]
    assert e["lemma"] == "achieve"
    for action in ("save", "difficult"):
        assert client.post(f"/api/vocab/entries/{e['id']}/progress", json={"action": action}).status_code == 200
    client.post(f"/api/vocab/entries/{e['id']}/progress", json={"action": "note", "value": "đạt mục tiêu"})
    d = client.get(f"/api/vocab/entries/{e['id']}").json()
    assert d["progress"]["saved"] and d["progress"]["difficult"] and d["progress"]["note"] == "đạt mục tiêu"
    assert any(c["name"] == "Từ khó của tôi" for c in d["collections"])
    assert client.get("/api/vocab/entries", params={"saved": True}).json()["total"] == 1
    tpl = client.post("/api/vocab/collections", json={"template": "travel"}).json()
    assert tpl["count"] > 50
    vietnamese = client.get("/api/vocab/entries", params={"q": "đạt được"}).json()
    assert any(x["lemma"] == "achieve" for x in vietnamese["items"])
    lvl = client.get("/api/vocab/entries", params={"level": "A1", "topic": "food-drinks", "size": 5}).json()
    assert lvl["total"] > 20 and all(x["cefr"] == "A1" for x in lvl["items"])


def test_capture_from_reading_and_writing_usage(client, app):
    r = client.post("/api/vocab/capture", json={"text": "Children", "module": "reading", "context": "Children love stories.", "ref": "R1"}).json()
    assert r["entry_id"] == "child" and not r["personal"] and r["added"]
    personal = client.post("/api/vocab/capture", json={"text": "make ends meet", "module": "writing", "meaning_vi": "xoay xở đủ sống"}).json()
    assert personal["personal"]
    learn = start(client, "learn", size=3)
    assert {learn["items"][0]["entry_id"], learn["items"][2]["entry_id"]} == {"child", personal["entry_id"]}  # chosen words first
    cols = {c["system_key"]: c["count"] for c in client.get("/api/vocab/collections").json()["collections"] if c["system_key"]}
    assert cols["reading"] == 1 and cols["writing"] == 1
    # a studied word used later in Writing counts as "used correctly" when no error covers it
    k = keys(app, learn["id"])
    for it in learn["items"]:
        answer_item(client, learn, it, store_answers=k)
    from app.vocabulary.service import record_usage

    with app.state.sessionmaker() as db:
        used = record_usage(db, 1, "My children are happy at school.", "writing", error_texts=["are happy"])
        db.commit()
    assert any(u["entry_id"] == "child" and u["correct"] for u in used)
    assert client.get("/api/vocab/stats").json()["counts"]["used_writing"] >= 1


def test_lookup_lemmatizes_inflected_forms(client):
    r = client.get("/api/vocab/lookup", params={"word": "went"}).json()
    assert r["entries"] and r["entries"][0]["lemma"] == "go"
    assert client.get("/api/vocab/lookup", params={"word": "zzzqx"}).json()["entries"] == []


def test_ai_features_need_ai_and_learning_still_works_without_it(client, app):
    e = client.get("/api/vocab/entries", params={"q": "achieve"}).json()["items"][0]
    r = client.post("/api/vocab/tutor", json={"entry_id": e["id"], "action": "explain"})
    assert r.status_code in (402, 403, 503) and r.json()["code"] == "ai_disabled"
    s = start(client, "use", size=3)
    use = s["items"][0]
    form = keys(app, s["id"])[use["id"]]["forms"][0]
    r = client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": use["id"], "sentence": f"I often {form} at home."})
    assert r.json()["code"] == "ai_disabled"
    assert r.status_code >= 400  # AI unavailable: nothing saved…
    ok = client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": use["id"], "sentence": "x y z", "self": "partly"}).json()
    assert ok["verdict"] == "self_partly"  # …and self-assessment keeps learning going
    assert start(client, "review")["status"] in ("active", "finished")


# ============================================================ AI (FakeProvider)
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
    ai_app.state.ai.gateway._calls.clear()
    return TestClient(ai_app)


def test_ai_tutor_uses_entry_context_and_caches(c, ai_app):
    e = c.get("/api/vocab/entries", params={"q": "achieve"}).json()["items"][0]
    a = c.post("/api/vocab/tutor", json={"entry_id": e["id"], "action": "explain"}).json()
    b = c.post("/api/vocab/tutor", json={"entry_id": e["id"], "action": "explain"}).json()
    assert a["answer"] and a == b
    assert ai_app.state.ai.gateway.provider.calls.count("text") == 1  # second answer from cache
    diff = c.post("/api/vocab/tutor", json={"entry_id": e["id"], "action": "difference", "compare_with": "accomplish"})
    assert diff.status_code == 200
    assert c.post("/api/vocab/tutor", json={"entry_id": e["id"], "action": "difference"}).status_code == 422


def test_use_it_yourself_ai_grading_and_usage(c, ai_app):
    s = start(c, "use", size=3)
    it = s["items"][0]
    lemma = it["word"].split(" (")[0]
    missing = c.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "sentence": "This sentence has nothing."}).json()
    assert missing["verdict"] == "missing_word" and not missing["correct"]  # deterministic, no AI call
    it2 = s["items"][1]
    lemma2 = keys(ai_app, s["id"])[it2["id"]]["forms"][0]
    good = c.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it2["id"], "sentence": f"I really {lemma2} it every day."}).json()
    assert good["ai"] and good["verdict"] == "correct" and good["explanation_vi"]
    d = c.get(f"/api/vocab/entries/{it2['entry_id']}").json()
    assert d["progress"]["used_correctly"]
    assert lemma


def test_use_it_outage_saves_nothing(c, ai_app):
    s = start(c, "use", size=3)
    it = s["items"][0]
    form = keys(ai_app, s["id"])[it["id"]]["forms"][0]
    ai_app.state.ai.gateway.provider.fail_next = AIUnavailable("down")
    r = c.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "sentence": f"We {form} things together."})
    assert r.status_code == 503 and r.json()["retryable"]
    assert c.get(f"/api/vocab/sessions/{s['id']}").json()["results"] == {}


def test_phrase_answer_second_layer(c, ai_app):
    s = start(c, "type", entry_ids=["have_a_shower"], size=3)
    k = keys(ai_app, s["id"])
    it = next(x for x in s["items"] if eid(k, x) == "have_a_shower")
    out = c.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "answer": "take a shower"}).json()
    assert out["ai_checked"] and out["verdict"] == "acceptable" and out["correct"]


def test_context_lookup_and_dialogue(c):
    r = c.post("/api/vocab/lookup/context", json={"word": "banks", "sentence": "We walked along the banks of the river."}).json()
    assert r["entry_id"] == "bank" and r["meaning_vi_in_context"]
    s = start(c, "flashcards", size=3)
    for it in s["items"]:
        c.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "rating": 3})
    ids = [it["entry_id"] for it in s["items"]]
    d = c.post("/api/vocab/dialogue", json={"situation": "daily", "entry_ids": ids}).json()
    target = d["targets"][0]["lemma"]
    rep = c.post(f"/api/vocab/dialogue/{d['id']}/reply", json={"text": f"I think {target} is useful."}).json()
    assert target in rep["used_now"] and rep["reply"]["text"]
    assert c.get(f"/api/vocab/entries/{ids[0]}").json()["progress"]["used_count"] >= 1


def test_ai_personalised_exercises_are_validated(c, ai_app):
    s = start(c, "flashcards", size=3)
    for it in s["items"]:
        c.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "rating": 1})
    r = c.post("/api/vocab/sessions/ai", json={"entry_ids": [it["entry_id"] for it in s["items"]]})
    assert r.status_code == 200, r.text
    ses = r.json()
    assert ses["items"] and all(it["ai_generated"] for it in ses["items"]) and '"answer"' not in json.dumps(ses["items"])
    k = keys(ai_app, ses["id"])
    out = answer_item(c, ses, ses["items"][0], right=True, store_answers=k)
    assert out["correct"] and out["note_vi"]


def test_enrichment_pipeline_is_resumable_and_reviewed(c, ai_app):
    st = c.get("/api/vocab/enrichment").json()
    assert st["candidates"] > 1000
    q = c.post("/api/vocab/enrichment/queue", json={"limit": 3}).json()
    assert q["queued"] == 3
    assert c.post("/api/vocab/enrichment/queue", json={"limit": 3}).json()["queued"] == 3  # next 3, no duplicates
    ai_app.state.ai.gateway.provider.fail_next = AIUnavailable("down")
    r = c.post("/api/vocab/enrichment/run", json={"batches": 1, "size": 3}).json()
    assert r["failed"] == 3 and r["jobs"]["failed"] == 3  # checkpoint: failure recorded
    r = c.post("/api/vocab/enrichment/run", json={"batches": 3, "size": 3}).json()
    assert r["done"] == 6 and r["needs_review"] == 6
    calls = len(ai_app.state.ai.gateway.provider.calls)
    c.post("/api/vocab/enrichment/run", json={"batches": 2, "size": 3})
    assert len(ai_app.state.ai.gateway.provider.calls) == calls  # finished jobs are never sent again
    review = c.get("/api/vocab/enrichment").json()["review"]
    job = review[0]
    lemma = job["lemma"]
    assert not c.get("/api/vocab/entries", params={"q": lemma}).json()["items"] or \
        all(x["lemma"] != lemma for x in c.get("/api/vocab/entries", params={"q": lemma}).json()["items"])  # not published yet
    eid = c.post(f"/api/vocab/enrichment/{job['id']}/approve").json()["entry_id"]
    d = c.get(f"/api/vocab/entries/{eid}").json()
    assert d["status"] == "reviewed" and d["senses"][0]["source"].startswith("ai:")
    assert c.post(f"/api/vocab/enrichment/{job['id']}/approve").status_code == 409
    assert c.post(f"/api/vocab/enrichment/{review[1]['id']}/reject").json() == {"ok": True}


def test_published_dataset_file_is_gzip_jsonl():
    lines = gzip.decompress(DATA_FILE.read_bytes()).decode().splitlines()
    assert all(json.loads(x)["id"] for x in lines[:20])


@pytest.mark.parametrize("mode", ["type", "dictation", "context", "collocation", "builder", "speed", "weak", "custom", "daily"])
def test_every_mode_builds_items_that_grade_correctly(client, app, mode):
    # some study history first: a few words learned, two of them forgotten repeatedly (→ weak words)
    s = start(client, "flashcards", level="A1", size=6)
    for i, it in enumerate(s["items"]):
        client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "rating": 1 if i < 2 else 3})
    k0 = keys(app, s["id"])
    weak_ids = [eid(k0, it) for it in s["items"][:2]]
    for w in weak_ids:
        client.post(f"/api/vocab/entries/{w}/progress", json={"action": "difficult"})
    params = {"collection": None}
    if mode == "custom":
        params = {"entry_ids": [eid(k0, it) for it in s["items"]]}
    elif mode == "collocation":
        params = {"level": "A1"}
    ses = start(client, mode, **{k: v for k, v in params.items() if v}, size=6) if mode != "daily" else start(client, "daily")
    assert ses["items"], mode
    k = keys(app, ses["id"])
    for it in ses["items"]:
        if it["type"] == "use_it":
            continue
        out = answer_item(client, ses, it, right=True, store_answers=k)
        if it["type"] != "learn":
            assert out["correct"], (mode, it["type"], out)
    if mode == "weak":
        assert {eid(k, it) for it in ses["items"]} & set(weak_ids)
    if mode == "dictation":
        r = client.get(f"/api/vocab/sessions/{ses['id']}/items/{ses['items'][0]['id']}/speak-text")
        assert r.status_code == 200 and r.json()["b64"]  # AI off → browser speech fallback text after the item exists


# ============================================================ intensive mode (e.g. 100 words/day)
def test_sprint_batches_triage_and_review_forecast(client, app):
    assert client.put("/api/vocab/settings", json={"daily_new": 100}).json()["daily_new"] == 100
    assert client.put("/api/vocab/settings", json={"daily_new": 151}).status_code == 422
    sp = client.get("/api/vocab/sprint").json()
    assert sp["goal"] == 100 and sp["batches_total"] == 10 and sp["batch_size"] == 10 and sp["learned_today"] == 0
    words = sp["next"]["words"]
    assert len(words) == 15 and all(w["word"] and w["meaning_vi"] for w in words)
    assert len(sp["review_forecast"]) == 7 and sp["review_forecast"][0]["reviews"] == 0
    # triage: two words are already known → skipped, not counted as learned
    known = [w["entry_id"] for w in words[:2]]
    assert client.post("/api/vocab/sprint/known", json={"entry_ids": known}).json() == {"known": 2}
    batch = [w["entry_id"] for w in words[2:12]]
    s = start(client, "sprint", entry_ids=batch)
    k = keys(app, s["id"])
    types = Counter(it["type"] for it in s["items"])
    assert types["learn"] == 10 and types["type_word"] == 10 and {eid(k, it) for it in s["items"]} == set(batch)
    assert sum(1 for it in s["items"] if it["round"] == 2) == 10  # last listening/recognition round, shuffled
    for it in s["items"]:
        answer_item(client, s, it, right=True, store_answers=k)
    client.post(f"/api/vocab/sessions/{s['id']}/finish")
    sp2 = client.get("/api/vocab/sprint").json()
    assert sp2["learned_today"] == 10 and sp2["batches_done"] == 1 and sp2["new_left"] == 90
    assert not set(known) & {w["entry_id"] for w in sp2["next"]["words"]}
    assert not set(batch) & {w["entry_id"] for w in sp2["next"]["words"]}
    assert sum(d["reviews"] for d in sp2["review_forecast"]) >= 10  # the new words are scheduled within the week


def test_known_words_from_triage_cannot_enter_a_sprint_and_daily_teaches_one_batch(client, app):
    client.put("/api/vocab/settings", json={"daily_new": 100})
    words = client.get("/api/vocab/sprint").json()["next"]["words"]
    client.post("/api/vocab/sprint/known", json={"entry_ids": [words[0]["entry_id"]]})
    s = start(client, "sprint", entry_ids=[w["entry_id"] for w in words[:4]])
    k = keys(app, s["id"])
    assert words[0]["entry_id"] not in {eid(k, it) for it in s["items"]}
    d = start(client, "daily")
    assert Counter(it["type"] for it in d["items"])["learn"] == 10  # 100/day is taught 10 at a time


def test_backlog_from_earlier_days_reduces_new_words_but_todays_steps_do_not(client, app):
    client.put("/api/vocab/settings", json={"daily_new": 100})
    s = start(client, "flashcards", level="A1", size=40)
    for it in s["items"]:
        client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "rating": 3})
    assert client.get("/api/vocab/plan").json()["new_goal"] == 100  # today's learning steps are not a backlog


# ============================================================ writing: translate Vietnamese → English
@pytest.mark.parametrize("answer, verdict", [
    ("I'm going to school.", "correct"), ("i am going to school", "correct"), ("Going I am to school", "wrong_order"),
    ("I go to the school", "mismatch"), ("", "incorrect")])
def test_translation_deterministic_layer(answer, verdict):
    g = grading.grade_translation(answer, "I am going to school.", ["go", "going"])
    assert g["verdict"] == verdict


def _studied(client, n=8):
    s = start(client, "flashcards", level="A1", size=n)
    for it in s["items"]:
        client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "rating": 3})


def test_translate_session_uses_studied_words_and_never_moves_the_schedule(client, app):
    _studied(client, 15)
    s = start(client, "translate", size=6)
    k = keys(app, s["id"])
    assert s["items"] and all(it["type"] == "translate" and it["vi"] and it["word"] and not it["scheduled"] for it in s["items"])
    first, second, third = s["items"][:3]
    ok = client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": first["id"], "answer": k[first["id"]]["en"]}).json()
    assert ok["verdict"] == "correct" and ok["expected"] == k[first["id"]]["en"]
    words = k[second["id"]]["en"].rstrip(".!?").split()
    shuffled = " ".join(words[1:] + words[:1]) if len(words) > 1 else "x"
    wo = client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": second["id"], "answer": shuffled}).json()
    assert wo["verdict"] == "wrong_order" and not wo["correct"]
    # AI unavailable: a different translation waits for the learner's own judgement, once
    mm = client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": third["id"], "answer": "Something else entirely here"}).json()
    assert mm["verdict"] == "mismatch" and mm["correct"] is None and mm["ai_unavailable"]
    sa = client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": third["id"], "self": "wrong"}).json()
    assert sa["verdict"] == "self_wrong" and sa["correct"] is False
    again = client.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": third["id"], "self": "correct"}).json()
    assert again["verdict"] == "self_wrong"  # decided once
    with app.state.sessionmaker() as db:
        logs = db.scalars(select(VocabReviewLog).where(VocabReviewLog.mode == "translate")).all()
        assert len(logs) == 3 and all(l.rating is None for l in logs)  # practice: no FSRS review
    daily = client.get("/api/writing/daily").json()
    tr = next(x for x in daily["steps"] if x["key"] == "translate")
    assert tr["done"] == 3 and tr["correct"] == 1 and daily["week"]["translations"] == 3
    assert daily["recent_translation_mistakes"] and daily["common_errors"]
    assert {x["key"] for x in daily["steps"]} == {"translate", "use", "paragraph"} and daily["level"] in ("A0", "A1", "A2", "B1", "B2")


def test_translate_ai_judge_accepts_a_close_alternative(c, ai_app):
    _studied(c, 15)
    s = start(c, "translate", size=3)
    k = keys(ai_app, s["id"])
    it = s["items"][0]
    alt = k[it["id"]]["en"] + " too"  # one extra word: not the model sentence, but the (fake) judge accepts small differences
    out = c.post(f"/api/vocab/sessions/{s['id']}/answer", json={"item_id": it["id"], "answer": alt}).json()
    assert out["ai_checked"] and out["verdict"] == "acceptable" and out["correct"] and out["ai_explanation_vi"]
