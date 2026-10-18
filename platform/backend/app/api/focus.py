"""Focus mode / study lock (/api/focus). The macOS Focus Lock app polls /status; the web app starts and ends sessions."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import focus as F
from ..models import User
from .deps import current_user, get_db

router = APIRouter(prefix="/api/focus", tags=["focus"])


def _run(db: Session, fn):
    try:
        out = fn()
    except F.FocusError as e:
        db.rollback()
        raise HTTPException(e.status, str(e)) from None
    db.commit()
    return out


@router.get("/status")
def status(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _run(db, lambda: F.status(db, user.id))


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _run(db, lambda: F.settings(db, user.id))


class SettingsIn(BaseModel):
    default_lessons: int | None = Field(None, ge=0, le=10)
    default_minutes: int | None = Field(None, ge=0, le=240)
    max_minutes: int | None = Field(None, ge=30, le=480)
    pin: str | None = Field(None, max_length=12)
    clear_pin: bool = False


@router.put("/settings")
def put_settings(body: SettingsIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _run(db, lambda: F.save_settings(db, user.id, body.model_dump()))


class StartIn(BaseModel):
    lessons: int = Field(0, ge=0, le=10)
    minutes: int = Field(0, ge=0, le=240)
    max_minutes: int | None = Field(None, ge=30, le=480)


@router.post("/start")
def start(body: StartIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _run(db, lambda: F.view(F.start(db, user.id, lessons=body.lessons, minutes=body.minutes, max_minutes=body.max_minutes)))


@router.post("/cancel")
def cancel(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _run(db, lambda: F.view(F.cancel(db, user.id)))


@router.post("/emergency/request")
def emergency_request(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _run(db, lambda: F.view(F.emergency_request(db, user.id)))


class ConfirmIn(BaseModel):
    pin: str | None = Field(None, max_length=12)
    phrase: str | None = Field(None, max_length=60)


@router.post("/emergency/confirm")
def emergency_confirm(body: ConfirmIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _run(db, lambda: F.view(F.emergency_confirm(db, user.id, pin=body.pin, phrase=body.phrase)))


class NativeIn(BaseModel):
    session_id: str = Field(min_length=1, max_length=36)


@router.post("/emergency/native")
def emergency_native(body: NativeIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _run(db, lambda: F.native_escape(db, user.id, body.session_id) or {"ok": True})


@router.get("/history")
def history(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return F.history(db, user.id)
