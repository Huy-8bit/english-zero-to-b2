"""Focus mode: a study session the learner starts voluntarily; the macOS Focus Lock app keeps the computer locked until
the session's goals (lessons completed and/or study minutes) are met.

Safety rules (the lock must never trap anyone):
- every session has a maximum duration after which it unlocks by itself;
- emergency unlock is always possible: request → wait 60 s → confirm with the PIN (or the phrase if no PIN is set);
- the native app unlocks by itself when this server cannot be reached and has its own offline escape key;
- a session can be cancelled during its first 60 seconds (started by mistake).
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import FocusSession, LearningProfile, utcnow

EMERGENCY_WAIT_SECONDS = 60
EMERGENCY_WINDOW_SECONDS = 600
CANCEL_GRACE_SECONDS = 60
PHRASE = "tôi muốn dừng học"
DEFAULTS = {"default_lessons": 2, "default_minutes": 30, "max_minutes": 180}


class FocusError(ValueError):
    def __init__(self, message: str, status: int = 409):
        super().__init__(message)
        self.status = status


def _prefs(db: Session, user_id: int) -> tuple[LearningProfile, dict]:
    p = db.get(LearningProfile, user_id)
    if p is None:
        p = LearningProfile(user_id=user_id, preferences={})
        db.add(p)
        db.flush()
    return p, dict((p.preferences or {}).get("focus", {}))


def settings(db: Session, user_id: int) -> dict:
    _, f = _prefs(db, user_id)
    return {k: f.get(k, v) for k, v in DEFAULTS.items()} | {"pin_set": bool(f.get("pin_hash")), "phrase": PHRASE}


def _hash(pin: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), 100_000).hex()


def save_settings(db: Session, user_id: int, values: dict) -> dict:
    if active(db, user_id):
        raise FocusError("Không đổi cài đặt khóa máy khi đang trong buổi học tập trung.")
    p, f = _prefs(db, user_id)
    for k in DEFAULTS:
        if values.get(k) is not None:
            f[k] = int(values[k])
    if values.get("clear_pin"):
        f.pop("pin_hash", None)
        f.pop("pin_salt", None)
    elif values.get("pin"):
        pin = str(values["pin"])
        if not (4 <= len(pin) <= 12 and pin.isdigit()):
            raise FocusError("PIN gồm 4–12 chữ số.", 422)
        salt = secrets.token_hex(8)
        f["pin_salt"], f["pin_hash"] = salt, _hash(pin, salt)
    p.preferences = {**(p.preferences or {}), "focus": f}
    return settings(db, user_id)


def active(db: Session, user_id: int) -> FocusSession | None:
    return db.scalar(select(FocusSession).where(FocusSession.user_id == user_id, FocusSession.status == "active")
                     .order_by(FocusSession.started_at.desc()))


def start(db: Session, user_id: int, *, lessons: int, minutes: int, max_minutes: int | None) -> FocusSession:
    if active(db, user_id):
        raise FocusError("Đang có một buổi học tập trung.")
    if lessons <= 0 and minutes <= 0:
        raise FocusError("Đặt ít nhất một mục tiêu: số bài hoặc số phút.", 422)
    mx = max_minutes or settings(db, user_id)["max_minutes"]
    mx = max(30, min(480, max(mx, minutes + 30)))  # the time goal must stay reachable before the safety limit
    s = FocusSession(id=str(uuid.uuid4()), user_id=user_id, status="active", goal_lessons=max(0, min(10, lessons)),
                     goal_minutes=max(0, min(240, minutes)), max_minutes=mx, seconds=0, lessons_done=[])
    db.add(s)
    db.flush()
    return s


def record(db: Session, user_id: int, *, key: str | None, seconds: int = 0, completed: bool = False) -> None:
    """Called from services.progress.log_study for every study record."""
    s = active(db, user_id)
    if s is None:
        return
    s.seconds = (s.seconds or 0) + max(0, int(seconds))
    if completed and key and key not in (s.lessons_done or []):
        s.lessons_done = [*(s.lessons_done or []), key]


def refresh(db: Session, s: FocusSession) -> FocusSession:
    if s.status != "active":
        return s
    now = utcnow()
    if len(s.lessons_done or []) >= s.goal_lessons and (s.seconds or 0) >= s.goal_minutes * 60:
        s.status, s.end_reason, s.ended_at = "completed", "Đã đạt mục tiêu", now
    elif now >= s.started_at + timedelta(minutes=s.max_minutes):
        s.status, s.end_reason, s.ended_at = "expired", f"Hết thời gian tối đa {s.max_minutes} phút (giới hạn an toàn)", now
    return s


def view(s: FocusSession | None) -> dict | None:
    if s is None:
        return None
    now = utcnow()
    req = s.emergency_requested_at
    return {"id": s.id, "status": s.status, "goal_lessons": s.goal_lessons, "goal_minutes": s.goal_minutes, "max_minutes": s.max_minutes,
            "lessons_done": s.lessons_done or [], "minutes_done": round((s.seconds or 0) / 60, 1), "started_at": s.started_at.isoformat(),
            "ends_by": (s.started_at + timedelta(minutes=s.max_minutes)).isoformat(), "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "end_reason": s.end_reason, "can_cancel": s.status == "active" and (now - s.started_at).total_seconds() <= CANCEL_GRACE_SECONDS,
            "emergency": None if not req else {"requested_at": req.isoformat(),
                                               "available_at": (req + timedelta(seconds=EMERGENCY_WAIT_SECONDS)).isoformat(),
                                               "wait_seconds": max(0, EMERGENCY_WAIT_SECONDS - int((now - req).total_seconds()))}}


def status(db: Session, user_id: int) -> dict:
    s = active(db, user_id)
    if s is not None:
        refresh(db, s)
    last = s or db.scalar(select(FocusSession).where(FocusSession.user_id == user_id).order_by(FocusSession.started_at.desc()))
    locked = s is not None and s.status == "active"
    return {"locked": locked, "session": view(last), "server_time": utcnow().isoformat()}


def cancel(db: Session, user_id: int) -> FocusSession:
    s = active(db, user_id)
    if s is None:
        raise FocusError("Không có buổi học tập trung nào.")
    if (utcnow() - s.started_at).total_seconds() > CANCEL_GRACE_SECONDS:
        raise FocusError("Chỉ hủy được trong 60 giây đầu. Hãy dùng mở khóa khẩn cấp nếu thật sự cần.")
    s.status, s.end_reason, s.ended_at = "cancelled", "Hủy ngay sau khi bắt đầu", utcnow()
    return s


def emergency_request(db: Session, user_id: int) -> FocusSession:
    s = active(db, user_id)
    if s is None:
        raise FocusError("Không có buổi học tập trung nào.")
    now = utcnow()
    if s.emergency_requested_at is None or (now - s.emergency_requested_at).total_seconds() > EMERGENCY_WINDOW_SECONDS:
        s.emergency_requested_at = now
    return s


def emergency_confirm(db: Session, user_id: int, *, pin: str | None, phrase: str | None) -> FocusSession:
    s = active(db, user_id)
    if s is None:
        raise FocusError("Không có buổi học tập trung nào.")
    req = s.emergency_requested_at
    now = utcnow()
    if req is None or (now - req).total_seconds() > EMERGENCY_WINDOW_SECONDS:
        raise FocusError("Hãy bấm yêu cầu mở khẩn cấp trước.")
    if (now - req).total_seconds() < EMERGENCY_WAIT_SECONDS:
        raise FocusError(f"Chờ thêm {EMERGENCY_WAIT_SECONDS - int((now - req).total_seconds())} giây.")
    _, f = _prefs(db, user_id)
    if f.get("pin_hash"):
        if not pin or not hmac.compare_digest(_hash(str(pin), f["pin_salt"]), f["pin_hash"]):
            raise FocusError("PIN không đúng.", 403)
    elif (phrase or "").strip().lower() != PHRASE:
        raise FocusError(f"Gõ đúng câu: “{PHRASE}”.", 403)
    s.status, s.end_reason, s.ended_at = "emergency", "Mở khóa khẩn cấp", now
    return s


def native_escape(db: Session, user_id: int, session_id: str) -> None:
    """The macOS app's offline escape key was used; record it so the history stays honest."""
    s = db.get(FocusSession, session_id)
    if s is not None and s.user_id == user_id and s.status == "active":
        s.status, s.end_reason, s.ended_at = "emergency", "Mở khóa khẩn cấp từ ứng dụng (phím thoát)", utcnow()


def history(db: Session, user_id: int, limit: int = 20) -> list[dict]:
    rows = db.scalars(select(FocusSession).where(FocusSession.user_id == user_id).order_by(FocusSession.started_at.desc()).limit(limit))
    return [view(s) for s in rows]
