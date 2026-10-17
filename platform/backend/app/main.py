"""FastAPI application: content APIs + learning data + AI features. Run: uvicorn app.main:app --reload"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import sessionmaker

from . import config
from .ai.errors import AIError
from .ai.services import build as build_ai
from .api import ai, analytics, assistant, auth, content, learning, vocab, vocabulary
from .content.store import ContentStore
from .database import init_db, make_engine

log = logging.getLogger("english.ai")


def create_app(database_url: str | None = None, content_root=None, ai_settings=None, ai_provider=None) -> FastAPI:
    engine = make_engine(database_url or config.DATABASE_URL)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield

    app = FastAPI(title="English Mastery API", version="2.0.0", lifespan=lifespan)
    init_db(engine)
    app.state.sessionmaker = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    app.state.store = ContentStore(content_root or config.CONTENT_ROOT, config.CONTENT_RELOAD_SECONDS)
    app.state.ai = build_ai(app.state.store, app.state.sessionmaker, ai_settings, ai_provider)
    from .vocabulary.ai import VocabAI
    from .vocabulary.lexicon import ensure_imported
    from .vocabulary.sessions import SessionService

    app.state.vocab_ai = VocabAI(app.state.ai.gateway, app.state.ai.kb)
    from .assistant import Assistant

    app.state.assistant = Assistant(app.state.ai.gateway, app.state.store)
    app.state.vocab_sessions = SessionService(ai=app.state.vocab_ai, gateway=app.state.ai.gateway)
    with app.state.sessionmaker() as db:  # idempotent: only does work when the lexicon file changed
        ensure_imported(db)
    app.add_middleware(auth.AuthMiddleware)
    app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"], allow_credentials=True)
    for r in (auth.router, content.router, learning.router, vocab.router, vocabulary.router, assistant.router, analytics.router, ai.router):
        app.include_router(r)

    @app.exception_handler(AIError)
    async def ai_error(_: Request, exc: AIError):
        # never log request bodies or keys; detail is an internal, key-free reason
        log.warning("AI error %s: %s", exc.code, exc.detail or "")
        return JSONResponse(exc.to_dict() | {"detail": exc.message_vi}, status_code=exc.status_code)

    @app.get("/api/health")
    def health():
        return {"ok": True, "units": len(app.state.store.unit_list)}

    return app


app = create_app()
