"""AlphaTradePro business-logic tests — risk, brokers, options, journal, pro routes."""
from __future__ import annotations

import unittest.mock as mock

from fastapi.testclient import TestClient

from app.main import app
from app.options import bs_price, greeks, implied_vol, option_chain
from app.risk import RiskLimits, check_order, position_size_for_risk, reset_rate_limiter

client = TestClient(app)


def setup_function(_fn=None):
    reset_rate_limiter()


def test_risk_allows_small_order():
    chk = check_order("RELIANCE", "BUY", 1, 2500.0, capital=100_000.0,
                      day_pnl=0.0, positions={}, limits=RiskLimits())
    assert chk.allowed, chk.reason


def test_risk_blocks_oversize():
    chk = check_order("RELIANCE", "BUY", 100, 2500.0, capital=100_000.0,
                      day_pnl=0.0, positions={}, limits=RiskLimits())
    assert not chk.allowed and "cap" in chk.reason.lower() or "exceeds" in chk.reason.lower()


def test_risk_blocks_after_daily_loss():
    chk = check_order("RELIANCE", "BUY", 1, 10.0, capital=100_000.0,
                      day_pnl=-50_000.0, positions={},
                      limits=RiskLimits(max_daily_loss=-10_000.0))
    assert not chk.allowed


def test_position_sizing_math():
    assert position_size_for_risk(100_000, 100.0, 95.0, 0.01) == 200
    assert position_size_for_risk(100_000, 100.0, 100.0) == 0


def test_broker_status_lists_four():
    r = client.get("/api/brokers/status")
    assert r.status_code == 200
    names = {b["broker"] for b in r.json()["brokers"]}
    assert {"zerodha", "angel", "dhan", "kotak"} <= names


def test_options_greeks_parity():
    ce = greeks(100.0, 100.0, 0.1, 0.05, 0.3, "CE")
    pe = greeks(100.0, 100.0, 0.1, 0.05, 0.3, "PE")
    assert abs((ce["delta"] - pe["delta"]) - 1.0) < 1e-6
    assert abs(ce["gamma"] - pe["gamma"]) < 1e-9
    px = bs_price(100.0, 100.0, 0.1, 0.05, 0.3, "CE")
    assert abs(implied_vol(px, 100.0, 100.0, 0.1, 0.05, "CE") - 0.3) < 0.02


def test_option_chain_shape():
    chain = option_chain(25000.0, 7, 3)
    assert len(chain["rows"]) == 7 and chain["pcr"] > 0


def test_greeks_endpoint():
    r = client.post("/api/options/greeks", json={
        "spot": 100.0, "strike": 100.0, "t_years": 0.1, "vol": 0.3, "kind": "CE"})
    assert r.status_code == 200 and "delta" in r.json()


def test_options_chain_endpoint_mocked():
    import app.pro as pro
    with mock.patch.object(pro, "_quote_for",
                           return_value={"symbol": "NIFTY", "price": 25000.0,
                                         "change_pct": 0.0, "volume": 0}):
        r = client.get("/api/options/chain?symbol=NIFTY")
    assert r.status_code == 200 and r.json()["rows"]


def test_journal_roundtrip_and_attribution(tmp_path, monkeypatch):
    import app.journal as journal_mod
    monkeypatch.setattr(journal_mod, "JOURNAL_FILE", tmp_path / "journal.json")
    import app.pro as pro
    monkeypatch.setattr(pro, "load_journal", journal_mod.load_journal)
    r = client.post("/api/journal", json={
        "symbol": "RELIANCE", "side": "BUY", "qty": 10,
        "entry": 100.0, "exit": 110.0, "strategy": "ema_crossover"})
    assert r.status_code == 200 and r.json()["pnl"] == 100.0
    a = client.get("/api/journal/attribution")
    assert a.status_code == 200 and a.json()["total_trades"] >= 1


def test_risk_preview_endpoint():
    r = client.post("/api/risk/preview", json={
        "symbol": "RELIANCE", "side": "BUY", "qty": 1, "price": 100.0})
    assert r.status_code == 200 and r.json()["allowed"] is True


def test_risk_limits_endpoint_names_mode():
    r = client.get("/api/risk/limits")
    assert r.status_code == 200
    assert r.json()["trading_mode"] in ("paper", "live")
