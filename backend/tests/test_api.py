"""API smoke tests (offline — no yfinance calls, only local endpoints)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["name"] == "alphatradepro"


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["trading_mode"] in ("paper", "live")


def test_list_strategies():
    r = client.get("/api/strategies")
    assert r.status_code == 200
    names = r.json()["strategies"]
    assert "ema_crossover" in names and "supertrend_follow" in names


def test_backtest_unknown_strategy_400():
    r = client.post(
        "/api/backtest",
        json={"symbol": "RELIANCE", "strategy": "nope", "params": {}},
    )
    assert r.status_code == 400
