"""Vocabulary module API (/api/vocab). Deterministic features never call AI; AI endpoints degrade gracefully."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai import media
from ..ai.errors import AIError
from ..ai.services import AIServices
from ..models import User, VocabCollection, VocabCollectionItem, VocabDialogue, VocabEntry, VocabSession
from ..vocabulary import analytics, enrich, lexicon, service as V, srs
from ..vocabulary.ai import SITUATIONS, TUTOR_ACTIONS, VocabAI
from ..vocabulary.sessions import MODES, SessionService, plan, profile, speak_fallback, sprint_status, weak_entries
from ..vocabulary.topics import TOPICS
from .deps import current_user, get_db

router = APIRouter(prefix="/api/vocab", tags=["vocab"])


def get_ai(request: Request) -> AIServices:
    return request.app.state.ai


def get_vai(request: Request) -> VocabAI:
    return request.app.state.vocab_ai


def get_sessions(request: Request) -> SessionService:
    return request.app.state.vocab_sessions


# ------------------------------------------------------------------ overview / explorer
@router.get("/overview")
def overview(db: Session = Depends(get_db), user: User = Depends(current_user)):
    lexicon.ensure_imported(db)
    pl = plan(db, user.id)
    st = analytics.stats(db, user.id)
    active = db.scalar(select(VocabSession).where(VocabSession.user_id == user.id, VocabSession.status == "active")
                       .order_by(VocabSession.updated_at.desc()))
    weak_ids = pl["weak"][:6]
    weak = V.cards(db, user.id, [e for i in weak_ids if (e := db.get(VocabEntry, i))])
    db.commit()
    return {"plan": pl, "stats": st, "recent": analytics.recent(db, user.id), "weak": weak,
            "continue": {"id": active.id, "kind": active.kind, "title_vi": MODES.get(active.kind), "answered": len(active.results or {}),
                         "total": len(active.items)} if active else None,
            "modes": MODES, "dataset": dataset_info(db)}


def dataset_info(db: Session) -> dict:
    from ..models import VocabDataset

    m = db.get(VocabDataset, 1)
    return {"version": m.version if m else None, "counts": m.counts if m else {}, "algorithm": srs.ALGORITHM}


@router.get("/topics")
def topics(db: Session = Depends(get_db), user: User = Depends(current_user)):
    st = analytics.stats(db, user.id)
    by = {t["id"]: t for t in st["by_topic"]}
    return [{**t, **{k: by.get(t["id"], {}).get(k, 0) for k in ("total", "encountered", "learned", "mastered")}} for t in TOPICS]


@router.get("/entries")
def entries(q: str | None = Query(None, max_length=80), level: str | None = Query(None, pattern="^(A1|A2|B1|B2|C1)$"),
            topic: str | None = None, kind: str | None = None, mastery: str | None = None, saved: bool | None = None,
            difficult: bool | None = None, collection: int | None = None, page: int = Query(1, ge=1), size: int = Query(30, ge=1, le=100),
            sort: Literal["order", "az"] = "order", db: Session = Depends(get_db), user: User = Depends(current_user)):
    return V.explore(db, user.id, q=q, level=level, topic=topic, kind=kind, mastery=mastery, saved=saved, collection=collection,
                     difficult=difficult, page=page, size=size, sort=sort)


@router.get("/entries/{entry_id}")
def entry(entry_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    d = V.detail(db, user.id, entry_id)
    if d is None:
        raise HTTPException(404, "Không tìm thấy từ")
    return d


class ProgressIn(BaseModel):
    action: Literal["save", "unsave", "known", "unknown", "difficult", "not_difficult", "suspend", "unsuspend", "note", "own_example", "learn"]
    value: str | None = Field(None, max_length=2000)


@router.post("/entries/{entry_id}/progress")
def entry_progress(entry_id: str, body: ProgressIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if V.detail(db, user.id, entry_id) is None:
        raise HTTPException(404, "Không tìm thấy từ")
    out = V.update_progress(db, user.id, entry_id, body.action, body.value)
    db.commit()
    return out


@router.get("/lookup")
def lookup(word: str = Query(..., min_length=1, max_length=80), db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Reading/Listening word lookup: surface form → lemma entries (dictionary data; no AI)."""
    lexicon.ensure_imported(db)
    ids = lexicon.find_ids(word)
    found = [d for i in ids[:3] if (d := V.detail(db, user.id, i))]
    return {"word": word, "lemmas": [lexicon.guess_lemmas(word)[0]], "entries": found}


class ContextIn(BaseModel):
    word: str = Field(min_length=1, max_length=80)
    sentence: str = Field(min_length=1, max_length=600)


@router.post("/lookup/context")
def lookup_context(body: ContextIn, db: Session = Depends(get_db), vai: VocabAI = Depends(get_vai), user: User = Depends(current_user)):
    """Meaning in this sentence (optional AI, cached). Falls back to dictionary senses on the client if AI is unavailable."""
    ids = lexicon.find_ids(body.word)
    d = V.detail(db, user.id, ids[0]) if ids else None
    out = vai.context_meaning(db, user.id, word=body.word, sentence=body.sentence, entry=d)
    db.commit()
    return out | {"entry_id": d["id"] if d else None}


# ------------------------------------------------------------------ notebook & collections
@router.get("/collections")
def list_collections(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return {"collections": V.collections(db, user.id), "templates": {k: v[0] for k, v in V.TEMPLATES.items()}}


class CollectionIn(BaseModel):
    name: str = Field("", max_length=120)
    description: str | None = Field(None, max_length=500)
    template: Literal["work", "travel", "vstep"] | None = None


@router.post("/collections")
def create_collection(body: CollectionIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not body.name.strip() and not body.template:
        raise HTTPException(422, "Cần tên bộ từ")
    out = V.create_collection(db, user.id, body.name, body.description, body.template)
    db.commit()
    return out


class CollectionPatch(BaseModel):
    name: str = Field(min_length=1, max_length=120)


@router.patch("/collections/{cid}")
def rename_collection(cid: int, body: CollectionPatch, db: Session = Depends(get_db), user: User = Depends(current_user)):
    c = db.get(VocabCollection, cid)
    if c is None or c.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy bộ từ")
    c.name = body.name.strip()
    db.commit()
    return {"ok": True}


@router.delete("/collections/{cid}")
def delete_collection(cid: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    c = db.get(VocabCollection, cid)
    if c is None or c.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy bộ từ")
    if c.system_key:
        raise HTTPException(400, "Không xóa được bộ từ hệ thống")
    for it in db.scalars(select(VocabCollectionItem).where(VocabCollectionItem.collection_id == cid)):
        db.delete(it)
    db.delete(c)
    db.commit()
    return {"ok": True}


class ItemIn(BaseModel):
    entry_id: str = Field(min_length=1, max_length=120)


@router.post("/collections/{cid}/items")
def add_item(cid: int, body: ItemIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if V.detail(db, user.id, body.entry_id) is None:
        raise HTTPException(404, "Không tìm thấy từ")
    try:
        added = V.add_to_collection(db, user.id, cid, body.entry_id, source_module="notebook")
    except PermissionError:
        raise HTTPException(404, "Không tìm thấy bộ từ") from None
    V.get_progress(db, user.id, body.entry_id).saved = True
    db.commit()
    return {"added": added}


@router.delete("/collections/{cid}/items/{entry_id}")
def remove_item(cid: int, entry_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    c = db.get(VocabCollection, cid)
    if c is None or c.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy bộ từ")
    it = db.scalar(select(VocabCollectionItem).where(VocabCollectionItem.collection_id == cid, VocabCollectionItem.entry_id == entry_id))
    if it:
        db.delete(it)
    db.commit()
    return {"ok": True}


class CaptureIn(BaseModel):
    text: str = Field("", max_length=120)
    entry_id: str | None = Field(None, max_length=120)
    module: Literal["reading", "listening", "writing", "speaking", "lesson"]
    context: str | None = Field(None, max_length=600)
    ref: str | None = Field(None, max_length=120)
    meaning_vi: str | None = Field(None, max_length=400)
    example: str | None = Field(None, max_length=300)


@router.post("/capture")
def capture(body: CaptureIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    try:
        out = V.capture(db, user.id, text=body.text, module=body.module, context=body.context, ref=body.ref,
                        meaning_vi=body.meaning_vi, example=body.example, entry_id=body.entry_id)
    except ValueError:
        raise HTTPException(422, "Chưa chọn từ") from None
    db.commit()
    return out


# ------------------------------------------------------------------ plan, settings, sessions
@router.get("/plan")
def get_plan(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return plan(db, user.id)


@router.get("/sprint")
def get_sprint(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Intensive learning: batches of 10 new words, the next batch to triage, and the real review load ahead."""
    return sprint_status(db, user.id)


class KnownIn(BaseModel):
    entry_ids: list[str] = Field(min_length=1, max_length=30)


@router.post("/sprint/known")
def sprint_known(body: KnownIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Triage: words the learner already knows are skipped (reversible on the word page); they do not count as learned today."""
    ids = list(db.scalars(select(VocabEntry.id).where(VocabEntry.id.in_(body.entry_ids))))
    for eid in ids:
        V.update_progress(db, user.id, eid, "known")
    db.commit()
    return {"known": len(ids)}


class SettingsIn(BaseModel):
    daily_new: int | None = Field(None, ge=0, le=150)
    retention: float | None = Field(None, ge=0.75, le=0.97)
    timed_speed: bool | None = None
    accent: Literal["uk", "us"] | None = None
    level: Literal["A1", "A2", "B1", "B2"] | None = None


@router.put("/settings")
def put_settings(body: SettingsIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    out = V.save_settings(db, user.id, body.model_dump(exclude_none=True))
    db.commit()
    return out


class SessionIn(BaseModel):
    kind: str = Field(pattern="^(" + "|".join(MODES) + ")$")
    topic: str | None = Field(None, max_length=40)
    level: Literal["A1", "A2", "B1", "B2", "C1"] | None = None
    collection: int | None = None
    entry_ids: list[str] | None = Field(None, max_length=60)
    size: int | None = Field(None, ge=3, le=40)


@router.post("/sessions")
def create_session(body: SessionIn, db: Session = Depends(get_db), svc: SessionService = Depends(get_sessions), user: User = Depends(current_user)):
    if body.collection:
        c = db.get(VocabCollection, body.collection)
        if c is None or c.user_id != user.id:
            raise HTTPException(404, "Không tìm thấy bộ từ")
    s = svc.create(db, user.id, body.kind, body.model_dump(exclude_none=True, exclude={"kind"}))
    db.commit()
    return svc.public(s)


class AISessionIn(BaseModel):
    entry_ids: list[str] | None = Field(None, max_length=6)


@router.post("/sessions/ai")
def create_ai_session(body: AISessionIn, db: Session = Depends(get_db), svc: SessionService = Depends(get_sessions), user: User = Depends(current_user)):
    """Personalised AI exercises for the learner's weak words (validated; falls back to deterministic modes on the client)."""
    ids = body.entry_ids or [p.entry_id for p in weak_entries(db, user.id, 6)]
    if not ids:
        raise HTTPException(422, "Chưa có từ yếu để tạo bài tập — hãy học và ôn vài từ trước.")
    try:
        s = svc.create_ai(db, user.id, ids)
    except ValueError:
        raise HTTPException(422, "Không tìm thấy từ") from None
    db.commit()
    return svc.public(s)


def _session(db: Session, user: User, sid: str) -> VocabSession:
    s = db.get(VocabSession, sid)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy phiên học")
    return s


@router.get("/sessions")
def list_sessions(status: str | None = Query(None, pattern="^(active|finished)$"), db: Session = Depends(get_db), user: User = Depends(current_user)):
    q = select(VocabSession).where(VocabSession.user_id == user.id)
    if status:
        q = q.where(VocabSession.status == status)
    rows = db.scalars(q.order_by(VocabSession.created_at.desc()).limit(30))
    return [{"id": s.id, "kind": s.kind, "title_vi": MODES.get(s.kind), "status": s.status, "answered": len(s.results or {}), "total": len(s.items),
             "created_at": s.created_at.isoformat(), "summary": s.summary} for s in rows]


@router.get("/sessions/{sid}")
def get_session(sid: str, db: Session = Depends(get_db), svc: SessionService = Depends(get_sessions), user: User = Depends(current_user)):
    return svc.public(_session(db, user, sid))


class AnswerIn(BaseModel):
    item_id: str = Field(min_length=1, max_length=20)
    rating: int | None = Field(None, ge=1, le=4)
    choice: int | None = Field(None, ge=0, le=10)
    answer: str | None = Field(None, max_length=400)
    tokens: list[str] | None = Field(None, max_length=30)
    sentence: str | None = Field(None, max_length=400)
    self: Literal["correct", "partly", "wrong"] | None = None
    override: Literal["accept"] | None = None
    duration_ms: int | None = Field(None, ge=0, le=3_600_000)
    client_review_id: str | None = Field(None, max_length=64)


@router.post("/sessions/{sid}/answer")
def answer(sid: str, body: AnswerIn, db: Session = Depends(get_db), svc: SessionService = Depends(get_sessions), user: User = Depends(current_user)):
    s = _session(db, user, sid)
    if s.status != "active":
        raise HTTPException(409, "Phiên học đã kết thúc")
    try:
        out = svc.answer(db, user.id, s, body.item_id, body.model_dump(exclude_none=True))
    except KeyError:
        raise HTTPException(404, "Không có câu hỏi này") from None
    except ValueError as e:
        db.rollback()
        raise HTTPException(422, str(e)) from None
    except AIError:
        db.rollback()  # e.g. Use-It grading while AI is unavailable: nothing saved; the client offers self-assessment
        raise
    db.commit()
    return out


@router.post("/sessions/{sid}/finish")
def finish(sid: str, db: Session = Depends(get_db), svc: SessionService = Depends(get_sessions), user: User = Depends(current_user)):
    s = _session(db, user, sid)
    summary = svc.finish(db, user.id, s)
    db.commit()
    return summary


@router.get("/sessions/{sid}/items/{item_id}/audio")
def item_audio(sid: str, item_id: str, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai),
               svc: SessionService = Depends(get_sessions), user: User = Depends(current_user)):
    """Audio for dictation / listening items without revealing the answer text. Cached: replay costs nothing."""
    s = _session(db, user, sid)
    try:
        it = svc.item(s, item_id)
    except KeyError:
        raise HTTPException(404, "Không có câu hỏi này") from None
    text = it["private"].get("speak") or it["public"].get("word") or it["public"].get("lemma")
    if not text:
        raise HTTPException(404, "Câu hỏi không có âm thanh")
    return _tts(db, ai, user, text, secret=True)


@router.get("/sessions/{sid}/items/{item_id}/speak-text")
def item_speak_text(sid: str, item_id: str, db: Session = Depends(get_db), svc: SessionService = Depends(get_sessions), ai: AIServices = Depends(get_ai),
                    user: User = Depends(current_user)):
    """Fallback for the browser's speech synthesis — only when server TTS is not available."""
    if ai.settings.enabled:
        raise HTTPException(409, "Dùng âm thanh từ máy chủ")
    s = _session(db, user, sid)
    try:
        it = svc.item(s, item_id)
    except KeyError:
        raise HTTPException(404, "Không có câu hỏi này") from None
    return {"b64": speak_fallback(it["private"].get("speak") or it["public"].get("word") or "")}


@router.get("/audio/{entry_id}")
def entry_audio(entry_id: str, accent: Literal["uk", "us"] = "uk", db: Session = Depends(get_db), ai: AIServices = Depends(get_ai),
                user: User = Depends(current_user)):
    e = db.get(VocabEntry, entry_id)
    if e is None:
        raise HTTPException(404, "Không tìm thấy từ")
    return _tts(db, ai, user, e.lemma, secret=False, accent=accent)


def _tts(db: Session, ai: AIServices, user: User, text: str, *, secret: bool, accent: str = "uk") -> dict:
    gw = ai.gateway
    model, voice = gw.settings.model("tts"), gw.settings.tts_voice
    instructions = "Speak clearly and naturally with a British accent." if accent == "uk" else "Speak clearly and naturally with an American accent."
    rel = media.tts_name(model, voice, text, instructions, provider=gw.provider.name)
    if not media.exists(rel):  # only the first play of a text costs a TTS request
        audio = gw.speech(db, user.id, feature="vocab_tts", text=text, voice=voice, instructions=instructions)
        media.write(rel, audio)
    return {"url": f"/api/media/{rel}", "cached": True}


# ------------------------------------------------------------------ analytics
@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return analytics.stats(db, user.id) | {"profile": profile(db, user.id), "dataset": dataset_info(db)}


# ------------------------------------------------------------------ AI tutor & dialogue
class TutorIn(BaseModel):
    entry_id: str = Field(min_length=1, max_length=120)
    action: str = Field(pattern="^(" + "|".join([*TUTOR_ACTIONS, "chat"]) + ")$")
    question: str = Field("", max_length=1000)
    compare_with: str | None = Field(None, max_length=120)


@router.post("/tutor")
def tutor(body: TutorIn, db: Session = Depends(get_db), vai: VocabAI = Depends(get_vai), user: User = Depends(current_user)):
    d = V.detail(db, user.id, body.entry_id)
    if d is None:
        raise HTTPException(404, "Không tìm thấy từ")
    compare = None
    if body.compare_with:
        ids = lexicon.find_ids(body.compare_with) or [body.compare_with]
        compare = V.detail(db, user.id, ids[0]) or {"lemma": body.compare_with, "senses": []}
    out = vai.tutor(db, user.id, entry=d, action=body.action, question=body.question, compare=compare)
    db.commit()
    return out


@router.get("/dialogue/situations")
def situations():
    return SITUATIONS


class DialogueIn(BaseModel):
    situation: str = Field(pattern="^(" + "|".join(SITUATIONS) + ")$")
    entry_ids: list[str] | None = Field(None, max_length=8)


@router.post("/dialogue")
def dialogue_start(body: DialogueIn, db: Session = Depends(get_db), vai: VocabAI = Depends(get_vai), user: User = Depends(current_user)):
    ids = body.entry_ids or ([x["id"] for x in V.explore(db, user.id, mastery="learning", size=5)["items"]]
                             + [x["id"] for x in V.explore(db, user.id, mastery="review", size=5)["items"]])
    entries = [d for i in ids[:8] if (d := V.detail(db, user.id, i))]
    if not entries:
        raise HTTPException(422, "Hãy học vài từ trước, rồi luyện dùng chúng trong hội thoại.")
    d = vai.dialogue_start(db, user.id, situation=body.situation, entries=entries)
    db.commit()
    return _dialogue_public(d, entries)


def _dialogue_public(d: VocabDialogue, entries: list[dict]) -> dict:
    return {"id": d.id, "situation": d.situation, "status": d.status, "turns": d.turns, "used": d.used,
            "targets": [{"entry_id": e["id"], "lemma": e["lemma"], "meaning_vi": e.get("meaning_vi")} for e in entries]}


class ReplyIn(BaseModel):
    text: str = Field(min_length=1, max_length=600)


@router.post("/dialogue/{did}/reply")
def dialogue_reply(did: str, body: ReplyIn, db: Session = Depends(get_db), vai: VocabAI = Depends(get_vai), user: User = Depends(current_user)):
    d = db.get(VocabDialogue, did)
    if d is None or d.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy hội thoại")
    if d.status != "active":
        raise HTTPException(409, "Hội thoại đã kết thúc")
    entries = [x for i in d.entry_ids if (x := V.detail(db, user.id, i))]
    out = vai.dialogue_reply(db, user.id, d, entries, body.text)
    for w in out["used_now"]:  # used in a conversation (estimate; AI corrections are shown to the learner)
        eid = next((e["id"] for e in entries if e["lemma"] == w), None)
        if eid:
            p = V.get_progress(db, user.id, eid)
            p.used_count = (p.used_count or 0) + 1
            p.used_in = {**(p.used_in or {}), "dialogue": (p.used_in or {}).get("dialogue", 0) + 1}
            if not out["turn"].get("corrections"):
                p.used_correctly_at = p.used_correctly_at or p.updated_at
    db.commit()
    return out | {"dialogue": _dialogue_public(d, entries)}


# ------------------------------------------------------------------ enrichment pipeline (review stage)
@router.get("/enrichment")
def enrichment_status(db: Session = Depends(get_db), user: User = Depends(current_user)):
    lexicon.ensure_imported(db)
    return enrich.status(db) | {"review": enrich.review_queue(db, 30), "dataset": dataset_info(db)}


class QueueIn(BaseModel):
    limit: int = Field(20, ge=1, le=200)


@router.post("/enrichment/queue")
def enrichment_queue(body: QueueIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    n = enrich.queue(db, body.limit)
    db.commit()
    return {"queued": n} | enrich.status(db)


class RunIn(BaseModel):
    batches: int = Field(1, ge=1, le=5)
    size: int = Field(8, ge=1, le=20)


@router.post("/enrichment/run")
def enrichment_run(body: RunIn, db: Session = Depends(get_db), vai: VocabAI = Depends(get_vai), user: User = Depends(current_user)):
    out = enrich.run(db, vai, user.id, batches=body.batches, size=body.size, log=lambda *_: None)
    db.commit()
    return out


@router.post("/enrichment/{job_id}/{decision}")
def enrichment_decide(job_id: int, decision: Literal["approve", "reject"], db: Session = Depends(get_db), user: User = Depends(current_user)):
    try:
        out = {"entry_id": enrich.approve(db, job_id)} if decision == "approve" else (enrich.reject(db, job_id) or {"ok": True})
    except ValueError as e:
        raise HTTPException(409, str(e)) from None
    db.commit()
    return out
