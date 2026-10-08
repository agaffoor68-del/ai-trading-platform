"""Google OAuth start + callback (lazy authlib import, stdlib fallback hints)."""
from __future__ import annotations

import json
import logging
import secrets

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse

from app.auth import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, _make_payload, _set_cookie, sign_session

logger = logging.getLogger(__name__)

oauth_router = APIRouter(prefix="/auth", tags=["auth"])


@oauth_router.get("/google")
def google_start(request: Request):
    """Start Google OAuth — returns {auth_url} JSON (frontend redirects)."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return JSONResponse(
            {"detail": "Google OAuth not configured. Settings page wizard se Client ID/Secret add karein."},
            status_code=501,
        )
    try:
        from authlib.integrations.requests_client import OAuth2Session  # type: ignore
    except ImportError:
        return JSONResponse({"detail": "authlib not installed (pip install authlib)."}, status_code=501)
    state = secrets.token_urlsafe(16)
    redirect_uri = str(request.url_for("google_callback"))
    session = OAuth2Session(client_id=GOOGLE_CLIENT_ID, client_secret=GOOGLE_CLIENT_SECRET,
                            redirect_uri=redirect_uri, scope="openid email profile")
    uri, _ = session.create_authorization_url(
        "https://accounts.google.com/o/oauth2/v2/auth", state=state)
    resp = JSONResponse({"auth_url": uri})
    resp.set_cookie("oauth_state", state, httponly=True, max_age=600, path="/", samesite="lax")
    return resp


@oauth_router.get("/google/callback", name="google_callback")
def google_callback(request: Request, code: str = "", state: str = ""):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return JSONResponse({"detail": "Google OAuth not configured."}, status_code=501)
    if not state or state != request.cookies.get("oauth_state", ""):
        return JSONResponse({"detail": "OAuth state mismatch."}, status_code=400)
    try:
        from authlib.integrations.requests_client import OAuth2Session  # type: ignore
    except ImportError:
        return JSONResponse({"detail": "authlib not installed."}, status_code=501)
    redirect_uri = str(request.url_for("google_callback"))
    session = OAuth2Session(client_id=GOOGLE_CLIENT_ID, client_secret=GOOGLE_CLIENT_SECRET,
                            redirect_uri=redirect_uri)
    token = session.fetch_token("https://oauth2.googleapis.com/token",
                                code=code, grant_type="authorization_code")
    access = token.get("access_token", "")
    import urllib.request
    req = urllib.request.Request("https://www.googleapis.com/oauth2/v2/userinfo",
                                 headers={"Authorization": f"Bearer {access}"})
    with urllib.request.urlopen(req, timeout=15) as fh:
        info = json.loads(fh.read().decode())
    email, name = info.get("email", ""), info.get("name", info.get("email", ""))
    if not email:
        return JSONResponse({"detail": "Google did not return an email."}, status_code=502)
    resp = RedirectResponse(url="/dashboard", status_code=302)
    _set_cookie(resp, sign_session(_make_payload(email, name, "google")))
    resp.delete_cookie("oauth_state", path="/")
    return resp
