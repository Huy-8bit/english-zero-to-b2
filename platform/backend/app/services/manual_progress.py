"""Manual curriculum status only: never award XP or record study activity."""
from sqlalchemy.orm import Session

from ..content.catalog import LEVELS
from ..content.store import ContentStore
from ..models import LessonProgress, utcnow
from .progress import progress_map, status_of


def up_to(store: ContentStore, *, unit_id: str | None, level: str | None, include_skills: bool):
    kinds = {"grammar", "skills", "communication"}
    target = store.unit(unit_id) if unit_id else None
    if unit_id and target is None:
        raise LookupError("Lesson not found")
    if target and (target.kind not in kinds or target.level not in LEVELS):
        raise ValueError("Choose a grammar, skills or communication lesson with a level")
    if target and target.kind != "grammar" and not include_skills:
        raise ValueError("Enable include_skills for a skills/communication target")
    selected = kinds if include_skills else {"grammar"}
    return [u for u in store.unit_list if u.kind in selected and u.level in LEVELS and (
        u.order <= target.order if target else LEVELS.index(u.level) <= LEVELS.index(level))]


def change(db: Session, user_id: int, store: ContentStore, units, status: str, *, dry_run: bool) -> dict:
    pm = progress_map(db, user_id)
    changes = [{"unit_id": u.id, "title": u.title, "level": u.level, "kind": u.kind,
                "previous_status": status_of(pm.get(u.id)), "status": status, "manual": True}
               for u in units if status_of(pm.get(u.id)) != status]
    if not dry_run:
        now = utcnow()
        for item in changes:
            uid = item["unit_id"]
            p = pm.get(uid)
            if p is None:
                p = LessonProgress(user_id=user_id, unit_id=uid, total_steps=len(store.built(uid).steps))
                db.add(p)
            # Retain real scores, drafts, step positions and completion counters.
            p.status = status
            p.manual = True
            p.completed_at = now if status == "completed" else None
            p.updated_at = now
        db.commit()
    return {"dry_run": dry_run, "count": len(changes), "changes": changes}
