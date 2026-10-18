"""Daily study plan (/api/plan) and smart review (/api/review)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import smart_review, study_plan
from ..content.store import ContentStore
from ..models import User
from .deps import current_user, get_db, get_store

router = APIRouter(tags=["plan"])


@router.get("/api/plan/today")
def today(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    out = study_plan.plan(db, user, store)
    db.commit()  # quest XP
    return out


@router.get("/api/review/smart")
def smart(quick: bool = False, db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    return smart_review.diagnose(db, user, store, quick=quick)


class CorrectionIn(BaseModel):
    answer: str = Field(min_length=1, max_length=600)


@router.post("/api/review/corrections/{record_id}")
def correction(record_id: int, body: CorrectionIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    try:
        out = smart_review.check_correction(db, user, record_id, body.answer)
    except KeyError:
        raise HTTPException(404, "Không tìm thấy lỗi này") from None
    db.commit()
    return out
