"""Course structure, lesson steps, learning path, search and reference documents."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..content.catalog import LEVEL_NAMES, LEVELS, MODULES
from ..content.store import ContentStore
from ..models import User
from ..services.progress import latest_attempts, progress_map, status_of
from .deps import current_user, get_db, get_store
from .results import result_payload

router = APIRouter(prefix="/api", tags=["content"])


def unit_row(u, p) -> dict:
    d = u.public()
    d.update(status=status_of(p), score=p.score if p else None, best_score=p.best_score if p else None,
             current_step=p.current_step if p else 0, total_steps=p.total_steps if p else None)
    return d


@router.get("/levels")
def levels(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    pm = progress_map(db, user.id)
    out = []
    for lv in LEVELS:
        units = [u for u in store.unit_list if u.level == lv]
        grammar = [u for u in units if u.kind == "grammar"]
        out.append({"id": lv, "name": LEVEL_NAMES[lv], "units": len(units), "grammar": len(grammar),
                    "completed": sum(1 for u in units if status_of(pm.get(u.id)) == "completed"),
                    "grammar_completed": sum(1 for u in grammar if status_of(pm.get(u.id)) == "completed")})
    return out


@router.get("/modules")
def modules(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    pm = progress_map(db, user.id)
    out = []
    for kind, name in MODULES.items():
        units = [u for u in store.unit_list if u.kind == kind]
        if units:
            out.append({"id": kind, "name": name, "units": len(units),
                        "completed": sum(1 for u in units if status_of(pm.get(u.id)) == "completed")})
    return out


@router.get("/lessons")
def lessons(kind: str | None = None, level: str | None = None, db: Session = Depends(get_db),
            store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    pm = progress_map(db, user.id)
    return [unit_row(u, pm.get(u.id)) for u in store.unit_list
            if (kind is None or u.kind == kind) and (level is None or u.level == level)]


def _neighbours(store: ContentStore, unit) -> tuple[str | None, str | None]:
    same = [u for u in store.unit_list if u.kind == unit.kind]
    idx = next(i for i, u in enumerate(same) if u.id == unit.id)
    prev_id = same[idx - 1].id if idx > 0 else None
    next_id = same[idx + 1].id if idx + 1 < len(same) else None
    return prev_id, next_id


@router.get("/lessons/{unit_id}")
def lesson(unit_id: str, db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    b = store.built(unit_id)
    if b is None:
        raise HTTPException(404, "Lesson not found")
    pm = progress_map(db, user.id)
    prev_id, next_id = _neighbours(store, b.unit)
    d = unit_row(b.unit, pm.get(unit_id))
    d.update(steps=len(b.steps), items=len(b.items), prev_id=prev_id, next_id=next_id,
             prerequisites=[{"id": p, "title": store.units[p].title, "status": status_of(pm.get(p))}
                            for p in b.unit.prerequisites if p in store.units])
    return d


@router.get("/lessons/{unit_id}/steps")
def lesson_steps(unit_id: str, db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    b = store.built(unit_id)
    if b is None:
        raise HTTPException(404, "Lesson not found")
    pm = progress_map(db, user.id)
    p = pm.get(unit_id)
    results = {iid: result_payload(b.items[iid], a) for iid, a in latest_attempts(db, user.id, unit_id).items() if iid in b.items}
    cards = {c["id"]: c for c in b.cards}
    if not cards:
        needed = {cid for st in b.steps for cid in st.get("card_ids", [])}
        if needed:
            cards = {c["id"]: c for c in store.cards() if c["id"] in needed}
    return {
        "unit": unit_row(b.unit, p),
        "steps": b.steps,  # items inside steps never contain answer keys
        "cards": cards,
        "results": results,
        "progress": None if p is None else {"current_step": p.current_step, "max_step": p.max_step, "state": p.state or {},
                                            "status": p.status, "score": p.score},
        "content_version": store.version,
    }


@router.get("/path")
def learning_path(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    pm = progress_map(db, user.id)
    levels_out = []
    for lv in LEVELS:
        blocks: dict[str, dict] = {}
        for u in store.unit_list:
            if u.kind == "grammar" and u.level == lv:
                blk = blocks.setdefault(u.block or lv, {"id": u.block or lv, "title": u.block_title or "", "lessons": []})
                blk["lessons"].append(unit_row(u, pm.get(u.id)))
        extras = [unit_row(u, pm.get(u.id)) for u in store.unit_list if u.level == lv and u.kind != "grammar"]
        levels_out.append({"id": lv, "name": LEVEL_NAMES[lv], "blocks": list(blocks.values()), "extras": extras})
    return {"levels": levels_out}


@router.get("/search")
def search(q: str = Query(min_length=2, max_length=100), store: ContentStore = Depends(get_store)):
    return {"query": q, "results": store.search(q)}


@router.get("/library")
def library(store: ContentStore = Depends(get_store)):
    return {"documents": store.reference_docs()}


@router.get("/docs")
def document(path: str = Query(min_length=3, max_length=300), store: ContentStore = Depends(get_store)):
    p = store.resolve_doc(path)
    if p is None:
        raise HTTPException(404, "Document not found")
    unit = store.unit_for_path(path)
    from ..content.catalog import doc_title

    return {"path": path, "title": doc_title(store.root, path), "markdown": p.read_text(encoding="utf-8"),
            "unit_id": unit.id if unit else None,
            "is_answer_file": path.startswith("12-ANSWERS-AND-EXPLANATIONS/") or path.endswith("PLACEMENT-ANSWERS.md"),
            "units_by_path": {u.path: u.id for u in store.unit_list}}


@router.get("/content/status")
def content_status(store: ContentStore = Depends(get_store)):
    store.refresh()
    return {"version": store.version, "units": len(store.unit_list), "reference_docs": len(store.refs),
            "content_root": store.root.name}


@router.post("/content/reload")
def content_reload(store: ContentStore = Depends(get_store)):
    changed = store.refresh(force=True)
    return {"reloaded": changed, "version": store.version}
