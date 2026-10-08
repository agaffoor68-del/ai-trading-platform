"""Tests — paper trading state machine (no network; apply_fill is pure)."""
from app.trading.engine import apply_fill, day_pnl


def _fresh():
    return {"orders": [], "positions": {}, "trades": [], "kill": False}


def test_buy_opens_long():
    s = _fresh()
    r = apply_fill(s, "RELIANCE", "BUY", 10, 1000.0, "MARKET", "MIS")
    assert r["status"] == "FILLED"
    assert s["positions"]["RELIANCE"] == {"qty": 10, "avg": 1000.0}


def test_sell_closes_with_profit():
    s = _fresh()
    apply_fill(s, "TCS", "BUY", 10, 1000.0, "MARKET", "MIS")
    apply_fill(s, "TCS", "SELL", 10, 1100.0, "MARKET", "MIS")
    assert s["positions"]["TCS"]["qty"] == 0
    assert s["trades"][-1]["pnl"] == 1000.0


def test_avg_price_weighted():
    s = _fresh()
    apply_fill(s, "INFY", "BUY", 10, 1000.0, "MARKET", "MIS")
    apply_fill(s, "INFY", "BUY", 10, 1200.0, "MARKET", "MIS")
    assert s["positions"]["INFY"] == {"qty": 20, "avg": 1100.0}


def test_order_and_trade_records():
    s = _fresh()
    apply_fill(s, "SBIN", "BUY", 5, 500.0, "LIMIT", "CNC")
    assert len(s["orders"]) == 1 and len(s["trades"]) == 1
    assert s["orders"][0]["order_id"] == s["trades"][0]["id"]


def test_day_pnl_counts_today_only():
    s = _fresh()
    apply_fill(s, "ITC", "BUY", 1, 100.0, "MARKET", "MIS")
    apply_fill(s, "ITC", "SELL", 1, 150.0, "MARKET", "MIS")
    assert day_pnl(s) == 50.0
    s["trades"].append({"date": "2000-01-01", "pnl": 9999.0})
    assert day_pnl(s) == 50.0


def test_live_blocked_and_kill(tmp_path, monkeypatch):
    import app.trading.router as router_mod
    import app.trading.routes as routes
    from fastapi.testclient import TestClient
    from app.main import app
    state = _fresh()
    state["kill"] = True
    monkeypatch.setattr(router_mod, "load_state", lambda: state)
    monkeypatch.setattr(routes, "_quote_for", lambda sym: {"symbol": sym, "price": 100.0,
                                                           "change_pct": 0.0, "volume": 0})
    client = TestClient(app)
    r = client.post("/api/order/place", json={
        "symbol": "RELIANCE", "qty": 1, "side": "BUY", "mode": "live"})
    assert r.status_code == 423  # live hard-blocked (checked first)
    r = client.post("/api/order/place", json={
        "symbol": "RELIANCE", "qty": 1, "side": "BUY", "mode": "paper"})
    assert r.status_code == 423  # kill-switch
