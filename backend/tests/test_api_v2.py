"""Tests for Phase-5 modules — auth JWT, paper trading engine, strategy registry."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.auth import sign_session, verify_session, _make_payload
from app.main import app


def test_jwt_roundtrip():
    token = sign_session(_make_payload("a@b.c", "Tester", "demo"))
    payload = verify_session(token)
    assert payload is not None and payload["email"] == "a@b.c"


def test_jwt_tamper_rejected():
    token = sign_session(_make_payload("a@b.c", "Tester", "demo"))
    assert verify_session(token + "x") is None
    assert verify_session("garbage") is None


def test_auth_me_unauthenticated():
    client = TestClient(app)
    r = client.get("/auth/me")
    assert r.status_code == 401


def test_demo_login_sets_cookie():
    client = TestClient(app)
    r = client.post("/auth/demo-login")
    assert r.status_code == 200
    assert "qe_session" in (r.headers.get("set-cookie") or "")
    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "demo@alphatradepro.local"


def test_strategy_list_has_builtins():
    client = TestClient(app)
    r = client.get("/api/strategy/list")
    assert r.status_code == 200
    names = [s["id"] for s in r.json()["strategies"]]
    assert "ema_crossover" in names and "rsi_reversion" in names


def test_strategy_create_and_deploy():
    client = TestClient(app)
    c = client.post("/api/strategy/create", json={"name": "t", "base": "ema_crossover"})
    assert c.status_code == 200
    sid = c.json()["id"]
    d = client.post(f"/api/strategy/{sid}/deploy", json={"target": "paper"})
    assert d.status_code == 200 and d.json()["ok"]


def test_live_order_blocked():
    client = TestClient(app)
    r = client.post("/api/order/place", json={
        "symbol": "RELIANCE", "qty": 1, "side": "BUY", "mode": "live"})
    assert r.status_code == 423


def test_backtest_run_tracking():
    client = TestClient(app)
    r = client.post("/api/backtest/run", json={
        "symbol": "RELIANCE", "strategy": "ema_crossover",
        "params": {"fast": 5, "slow": 10}, "period": "6mo"})
    # Yahoo unavailable in CI -> 502 acceptable; tracking contract matters
    assert r.status_code in (200, 502)
    if r.status_code == 200:
        rid = r.json()["id"]
        g = client.get(f"/api/backtest/{rid}")
        assert g.status_code == 200
        lst = client.get("/api/backtest/list")
        assert any(x["id"] == rid for x in lst.json()["runs"])


def test_strategy_deploy_compat():
    client = TestClient(app)
    r = client.post("/api/strategy/deploy", json={"symbol": "RELIANCE", "target": "paper"})
    assert r.status_code == 200 and r.json()["ok"]
    r2 = client.post("/api/strategy/deploy", json={"symbol": "RELIANCE", "target": "live"})
    assert r2.status_code == 423


def test_market_depth_shape():
    import unittest.mock as mock
    import app.market as market_mod
    client = TestClient(app)
    with mock.patch.object(market_mod, "_quote_for",
                           return_value={"symbol": "RELIANCE", "price": 2500.0,
                                         "change_pct": 0.5, "volume": 1000}):
        r = client.get("/api/market/depth?symbol=RELIANCE")
    assert r.status_code == 200
    body = r.json()
    assert len(body["bids"]) == 5 and len(body["asks"]) == 5
    assert all(b["price"] < 2500.0 for b in body["bids"])
    assert all(a["price"] > 2500.0 for a in body["asks"])


def test_orders_mode_filter():
    import app.trading.engine as eng
    client = TestClient(app)
    state = eng.load_state()
    state["orders"].append({"order_id": "T-1", "symbol": "X", "side": "BUY",
                            "qty": 1, "status": "FILLED", "mode": "paper",
                            "ts": "2024-01-01 09:15:00"})
    eng.save_state(state)
    try:
        r = client.get("/api/orders?mode=paper")
        assert r.status_code == 200
        assert all(o.get("mode", "paper") == "paper" for o in r.json()["orders"])
    finally:
        state = eng.load_state()
        state["orders"] = [o for o in state["orders"] if o.get("order_id") != "T-1"]
        eng.save_state(state)

