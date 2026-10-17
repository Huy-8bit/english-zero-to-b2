"""Dashboard, statistics, recommendations, achievements and profile."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..content.store import ContentStore
from ..models import Attempt, LessonProgress, User, XPEvent
from ..schemas import ProfileIn
from ..services import progress as P
from .deps import current_user, get_db, get_store

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    data = P.dashboard(db, user, store)
    db.commit()
    return data


@router.get("/recommendations")
def recommendations(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    return P.recommendations(db, user, store)


@router.get("/stats")
def stats(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    by_verdict = dict(db.execute(select(Attempt.verdict, func.count()).where(Attempt.user_id == user.id).group_by(Attempt.verdict)).all())
    by_kind: dict[str, dict] = {}
    for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == user.id)):
        u = store.units.get(p.unit_id)
        if not u:
            continue
        k = by_kind.setdefault(u.kind, {"kind": u.kind, "started": 0, "completed": 0, "minutes": 0, "total": 0})
        k["started"] += 1
        k["completed"] += int(p.completed_at is not None)
        k["minutes"] += round(p.time_spent_sec / 60)
    for u in store.unit_list:
        by_kind.setdefault(u.kind, {"kind": u.kind, "started": 0, "completed": 0, "minutes": 0, "total": 0})["total"] += 1
    xp_by_reason = dict(db.execute(select(XPEvent.reason, func.sum(XPEvent.amount)).where(XPEvent.user_id == user.id).group_by(XPEvent.reason)).all())
    history = [{"unit_id": p.unit_id, "title": store.units[p.unit_id].title if p.unit_id in store.units else p.unit_id,
                "kind": store.units[p.unit_id].kind if p.unit_id in store.units else "", "status": p.status, "score": p.score,
                "best_score": p.best_score, "minutes": round(p.time_spent_sec / 60),
                "completed_at": p.completed_at.isoformat() if p.completed_at else None, "updated_at": p.updated_at.isoformat()}
               for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == user.id).order_by(LessonProgress.updated_at.desc()))]
    return {"attempts": by_verdict, "modules": list(by_kind.values()), "xp_by_reason": xp_by_reason, "history": history,
            "achievements": P.achievements(db, user.id), "streak": P.streak(db, user.id), "xp_total": P.total_xp(db, user.id)}


@router.get("/profile")
def profile(user: User = Depends(current_user)):
    return {"name": user.name, "daily_goal_minutes": user.daily_goal_minutes, "weekly_goal_lessons": user.weekly_goal_lessons}


@router.put("/profile")
def update_profile(body: ProfileIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    for field in ("name", "daily_goal_minutes", "weekly_goal_lessons"):
        v = getattr(body, field)
        if v is not None:
            setattr(user, field, v)
    db.commit()
    return {"name": user.name, "daily_goal_minutes": user.daily_goal_minutes, "weekly_goal_lessons": user.weekly_goal_lessons}
