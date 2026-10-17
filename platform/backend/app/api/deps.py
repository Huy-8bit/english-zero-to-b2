from __future__ import annotations

from collections.abc import Iterator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from ..content.store import ContentStore
from ..models import User
from ..services.progress import get_user


def get_db(request: Request) -> Iterator[Session]:
    db = request.app.state.sessionmaker()
    try:
        yield db
    finally:
        db.close()
        ai = getattr(request.app.state, "ai", None)
        if ai is not None:
            ai.gateway.flush_logs()  # after the request session released its locks


def get_store(request: Request) -> ContentStore:
    return request.app.state.store


def current_user(db: Session = Depends(get_db)) -> User:
    # Single local profile for now; replace with real authentication later.
    return get_user(db)
