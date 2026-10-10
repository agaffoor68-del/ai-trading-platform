"""JWT session auth — Google OAuth + demo login fallback (stdlib-only JWT)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "qe_session"
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def sign_session(payload: dict) -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64url(json.dumps(payload).encode())
    sig = _b64url(hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"


def verify_session(token: str) -> dict | None:
    try:
        header, body, sig = token.split(".")
        expected = _b64url(hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_b64url_decode(body))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def session_from_request(request: Request) -> dict | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return verify_session(token)


def _set_cookie(resp: JSONResponse | RedirectResponse, token: str) -> None:
    resp.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax",
                    max_age=7 * 24 * 3600, path="/")


def _make_payload(email: str, name: str, mode: str) -> dict:
    now = int(time.time())
    return {"email": email, "name": name, "mode": mode,
            "iat": now, "exp": now + 7 * 24 * 3600}


@router.get("/me")
def me(request: Request):
    sess = session_from_request(request)
    if not sess:
        return JSONResponse({"detail": "not authenticated"}, status_code=401)
    return {"email": sess["email"], "name": sess["name"], "mode": sess.get("mode", "demo")}


@router.post("/demo-login")
def demo_login():
    payload = _make_payload("demo@alphatradepro.local", "Demo Trader", "demo")
    resp = JSONResponse({"email": payload["email"], "name": payload["name"], "mode": "demo"})
    _set_cookie(resp, sign_session(payload))
    return resp


@router.post("/logout")
def logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE_NAME, path="/")
    return resp


@router.get("/config-status")
def config_status():
    try:
        import authlib  # noqa: F401  # type: ignore
        has_authlib = True
    except ImportError:
        has_authlib = False
    return {
        "google_oauth": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
        "authlib_installed": has_authlib,
        "llm_key": bool(os.getenv("LLM_API_KEY", "")),
        "hint": ("Google Cloud Console -> Credentials -> Create OAuth client ID (Web app) -> "
                 "redirect URI: use the same app origin + /auth/google/callback -> "
                 ".env me GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET likhein."),
    }
