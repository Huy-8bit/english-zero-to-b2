"""Learning state the web app keeps in the browser, mirrored here per key (newest change wins)."""
from __future__ import annotations

import json
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ClientState, User, utcnow
from .deps import current_user, get_db

router = APIRouter(prefix="/api/state", tags=["state"])
KEY = r"^em-[a-z0-9][a-z0-9:._-]{0,110}$"
MAX_BYTES = 1_000_000


class Entry(BaseModel):
    value: Any = None
    ts: int = Field(ge=0)


class StateIn(BaseModel):
    items: dict[str, Entry] = Field(max_length=200)


@router.get("")
def get_state(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(ClientState).where(ClientState.user_id == user.id))
    return {"items": {r.key: {"value": r.value, "ts": r.ts} for r in rows}}


@router.put("")
def put_state(body: StateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Store each entry unless the server already has a newer change; answers what the server now holds for them."""
    out = {}
    for key, e in body.items.items():
        if not re.match(KEY, key):
            raise HTTPException(422, f"Khóa không hợp lệ: {key}")
        if len(json.dumps(e.value, ensure_ascii=False)) > MAX_BYTES:
            raise HTTPException(413, f"Dữ liệu quá lớn: {key}")
        row = db.get(ClientState, (user.id, key))
        if row is None:
            row = ClientState(user_id=user.id, key=key, value=e.value, ts=e.ts)
            db.add(row)
        elif e.ts >= row.ts:
            row.value, row.ts, row.updated_at = e.value, e.ts, utcnow()
        out[key] = {"value": row.value, "ts": row.ts}
    db.commit()
    return {"items": out}
