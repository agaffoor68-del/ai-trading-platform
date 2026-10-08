"""Tests — auth JWT round-trip + config-status."""
from app.auth import sign_session, verify_session, session_from_request


def test_jwt_round_trip():
    from app.auth import _make_payload
    token = sign_session(_make_payload("a@b.c", "AB", "demo"))
    payload = verify_session(token)
    assert payload and payload["email"] == "a@b.c"


def test_jwt_tamper_rejected():
    from app.auth import _make_payload
    token = sign_session(_make_payload("a@b.c", "AB", "demo"))
    bad = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
    assert verify_session(bad) is None


def test_jwt_expired_rejected():
    payload = {"email": "x@y.z", "name": "X", "mode": "demo", "iat": 1, "exp": 2}
    assert verify_session(sign_session(payload)) is None


def test_no_cookie_no_session():
    class Req:
        cookies = {}
    assert session_from_request(Req()) is None  # type: ignore[arg-type]


def test_config_status_shape():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    r = client.get("/auth/config-status")
    assert r.status_code == 200
    body = r.json()
    assert {"google_oauth", "authlib_installed", "llm_key", "hint"} <= set(body)
