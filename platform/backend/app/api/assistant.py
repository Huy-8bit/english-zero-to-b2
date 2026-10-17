"""Learning assistant (/api/assistant): questions about the learner's own progress, vocabulary, mistakes and next steps."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..assistant import ACTIONS, Assistant, snapshot
from ..content.store import ContentStore
from ..models import User
from .deps import current_user, get_db, get_store

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


def get_assistant(request: Request) -> Assistant:
    return request.app.state.assistant


class AskIn(BaseModel):
    message: str = Field("", max_length=1000)
    action: str | None = Field(None, pattern="^(" + "|".join(ACTIONS) + ")$")


@router.get("/actions")
def actions():
    return ACTIONS


@router.get("/insights")
def insights(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    """The data the assistant uses (deterministic; no AI call)."""
    return snapshot(db, user, store)


@router.post("/chat")
def chat(body: AskIn, db: Session = Depends(get_db), a: Assistant = Depends(get_assistant), user: User = Depends(current_user)):
    out = a.ask(db, user, message=body.message, action=body.action)
    db.commit()
    return out


@router.get("/history")
def history(db: Session = Depends(get_db), a: Assistant = Depends(get_assistant), user: User = Depends(current_user)):
    return a.history(db, user.id)


@router.delete("/history")
def clear(db: Session = Depends(get_db), a: Assistant = Depends(get_assistant), user: User = Depends(current_user)):
    a.clear(db, user.id)
    db.commit()
    return {"ok": True}
