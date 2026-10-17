"""FastAPI application: content APIs + learning data. Run: uvicorn app.main:app --reload"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from . import config
from .api import analytics, content, learning, tutor, vocab
from .content.store import ContentStore
from .database import init_db, make_engine


def create_app(database_url: str | None = None, content_root=None) -> FastAPI:
    engine = make_engine(database_url or config.DATABASE_URL)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(engine)
        yield

    app = FastAPI(title="English Mastery API", version="1.0.0", lifespan=lifespan)
    app.state.sessionmaker = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    app.state.store = ContentStore(content_root or config.CONTENT_ROOT, config.CONTENT_RELOAD_SECONDS)
    init_db(engine)
    app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
    for r in (content.router, learning.router, vocab.router, analytics.router, tutor.router):
        app.include_router(r)

    @app.get("/api/health")
    def health():
        return {"ok": True, "units": len(app.state.store.unit_list)}

    return app


app = create_app()
