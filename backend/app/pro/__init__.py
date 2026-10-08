"""AlphaTradePro extended business-logic routes — risk, brokers, options, journal."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app import config
from app.brokers import BROKERS, broker_status
from app.journal import add_entry, attribution, load_journal
from app.market import _quote_for
from app.options import greeks, implied_vol, option_chain
from app.risk import RiskLimits, check_order, position_size_for_risk
from app.trading.engine import START_CAPITAL, day_pnl, load_state

router = APIRouter(prefix="/api", tags=["alphatradepro"])


# ---- Risk ----
class RiskPreviewBody(BaseModel):
    symbol: str = "RELIANCE"
    side: str = "BUY"
    qty: int = Field(1, gt=0)
    price: float = Field(..., gt=0)


@router.post("/risk/preview")
def risk_preview(body: RiskPreviewBody):
    state = load_state()
    chk = check_order(body.symbol.upper(), body.side, body.qty, body.price,
                      capital=START_CAPITAL, day_pnl=day_pnl(state),
                      positions=state["positions"], limits=RiskLimits())
    return {"allowed": chk.allowed, "reason": chk.reason,
            "position_value": round(chk.position_value, 2),
            "exposure_pct": round(chk.exposure_pct * 100, 3)}


@router.get("/risk/limits")
def risk_limits():
    lim = RiskLimits()
    return {"max_daily_loss": lim.max_daily_loss, "max_position_pct": lim.max_position_pct,
            "max_order_qty": lim.max_order_qty, "max_orders_per_sec": lim.max_orders_per_sec,
            "sebi_order_rate_limit": config.SEBI_ORDER_RATE_LIMIT,
            "trading_mode": config.TRADING_MODE}


@router.get("/risk/size")
def risk_size(entry: float, stop: float, capital: float = START_CAPITAL,
              risk_pct: float = 0.01):
    return {"qty": position_size_for_risk(capital, entry, stop, risk_pct),
            "risk_amount": round(capital * risk_pct, 2)}


# ---- Brokers ----
@router.get("/brokers/status")
def brokers_status():
    return {"trading_mode": config.TRADING_MODE, "brokers": broker_status()}


@router.post("/brokers/{name}/connect")
def broker_connect(name: str):
    key = name.lower()
    if key not in BROKERS:
        raise HTTPException(status_code=404, detail=f"unknown broker '{name}'")
    st = BROKERS[key].status()
    return {"broker": key, **st,
            "hint": "Add credentials in Settings, then reconnect." if not st["connected"] else "Ready for live routing."}


# ---- Options ----
@router.get("/options/chain")
def options_chain(symbol: str = "NIFTY", expiry_days: int = 7):
    try:
        spot = _quote_for(symbol.strip().upper() or "RELIANCE")["price"]
    except HTTPException as exc:
        raise HTTPException(status_code=502, detail=f"no spot for {symbol}") from exc
    return {"symbol": symbol.upper(), **option_chain(spot, expiry_days)}


class GreeksBody(BaseModel):
    spot: float = Field(..., gt=0)
    strike: float = Field(..., gt=0)
    t_years: float = Field(..., gt=0)
    rate: float = 0.065
    vol: float = Field(..., gt=0)
    kind: str = "CE"


@router.post("/options/greeks")
def options_greeks(body: GreeksBody):
    kind = body.kind.upper()
    if kind not in ("CE", "PE"):
        raise HTTPException(status_code=400, detail="kind must be CE|PE")
    return {"kind": kind, **greeks(body.spot, body.strike, body.t_years, body.rate, body.vol, kind)}


@router.get("/options/iv")
def options_iv(price: float, spot: float, strike: float, t_years: float,
               rate: float = 0.065, kind: str = "CE"):
    return {"iv": implied_vol(price, spot, strike, t_years, rate, kind.upper())}


# ---- Journal ----
class JournalBody(BaseModel):
    symbol: str
    side: str = "BUY"
    qty: int = Field(1, gt=0)
    entry: float = Field(..., gt=0)
    exit: float = Field(..., gt=0)
    strategy: str = "manual"
    notes: str = ""
    tags: list[str] = Field(default_factory=list)
    rating: int = Field(0, ge=0, le=5)


@router.get("/journal")
def journal_list(limit: int = Query(100, le=500)):
    entries = load_journal()
    return {"entries": list(reversed(entries[-limit:])), "total": len(entries)}


@router.post("/journal")
def journal_add(body: JournalBody):
    if body.side not in ("BUY", "SELL"):
        raise HTTPException(status_code=400, detail="side must be BUY|SELL")
    pnl = (body.exit - body.entry) * body.qty * (1 if body.side == "BUY" else -1)
    return add_entry(body.symbol, body.side, body.qty, body.entry, body.exit,
                     pnl, body.strategy, body.notes, body.tags, body.rating)


@router.get("/journal/attribution")
def journal_attribution():
    return attribution()
