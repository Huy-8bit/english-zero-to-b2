"""Optional access protection. Set APP_ACCESS_TOKEN to require a login before any /api call.

The browser exchanges the token once for an HttpOnly cookie (HMAC-signed); scripts may send
`Authorization: Bearer <token>`. Without APP_ACCESS_TOKEN the app is open (local, single-user use).
"""
from __future__ import annotations

import hashlib
import hmac
import time

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .. import config

COOKIE = "em_session"
PUBLIC = ("/api/health", "/api/auth/")
MAX_AGE = 30 * 24 * 3600


def _sign(ts: str) -> str:
    return hmac.new(config.APP_ACCESS_TOKEN.encode(), f"em:{ts}".encode(), hashlib.sha256).hexdigest()


def _valid_cookie(value: str | None) -> bool:
    if not value or "." not in value:
        return False
    ts, sig = value.split(".", 1)
    if not ts.isdigit() or time.time() - int(ts) > MAX_AGE:
        return False
    return hmac.compare_digest(sig, _sign(ts))


def authorized(request: Request) -> bool:
    if not config.APP_ACCESS_TOKEN:
        return True
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer ") and hmac.compare_digest(auth[7:].strip(), config.APP_ACCESS_TOKEN):
        return True
    return _valid_cookie(request.cookies.get(COOKIE))


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/api") and not path.startswith(PUBLIC) and not authorized(request):
            return JSONResponse({"detail": "Cần đăng nhập", "code": "auth_required"}, status_code=401)
        return await call_next(request)


router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    token: str = Field(min_length=1, max_length=500)


@router.get("/status")
def status(request: Request):
    return {"required": bool(config.APP_ACCESS_TOKEN), "authenticated": authorized(request)}


@router.post("/login")
def login(body: LoginIn, response: Response, request: Request):
    if not config.APP_ACCESS_TOKEN:
        return {"authenticated": True}
    if not hmac.compare_digest(body.token, config.APP_ACCESS_TOKEN):
        time.sleep(0.5)
        raise HTTPException(401, "Sai mã truy cập")
    ts = str(int(time.time()))
    response.set_cookie(COOKIE, f"{ts}.{_sign(ts)}", max_age=MAX_AGE, httponly=True, samesite="lax",
                        secure=request.url.scheme == "https")
    return {"authenticated": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"authenticated": False}
