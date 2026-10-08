"""Market data API — quotes + OHLC history for charts (Yahoo-backed, cached)."""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, HTTPException, Query

from app.data.yahoo import DataEngineError, fetch_candles, normalize_symbol

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/market", tags=["market"])

# Tiny in-process quote cache (Redis plug-in later): symbol -> (ts, payload)
_QUOTE_CACHE: dict[str, tuple[float, dict]] = {}
_QUOTE_TTL = 15.0


def _quote_for(symbol: str) -> dict:
    now = time.time()
    hit = _QUOTE_CACHE.get(symbol.upper())
    if hit and now - hit[0] < _QUOTE_TTL:
        return hit[1]
    try:
        df = fetch_candles(symbol, period="5d", interval="1d")
    except (DataEngineError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if df.empty:
        raise HTTPException(status_code=502, detail=f"no data for {symbol}")
    last, prev = float(df["Close"].iloc[-1]), float(df["Close"].iloc[-2]) if len(df) > 1 else float(df["Close"].iloc[-1])
    payload = {
        "symbol": symbol.strip().upper(),
        "price": round(last, 2),
        "change_pct": round((last / prev - 1) * 100, 3) if prev else 0.0,
        "volume": int(df["Volume"].iloc[-1]) if "Volume" in df else 0,
    }
    _QUOTE_CACHE[symbol.upper()] = (now, payload)
    return payload


@router.get("/quotes")
def quotes(symbols: str = Query(..., description="comma-separated NSE symbols")):
    out, errors = [], {}
    for sym in [s.strip() for s in symbols.split(",") if s.strip()][:30]:
        try:
            out.append(_quote_for(sym))
        except HTTPException as exc:
            errors[sym] = exc.detail
    return {"quotes": out, "errors": errors}


@router.get("/depth")
def depth(symbol: str = Query("RELIANCE", description="NSE symbol")):
    """Synthetic 5-level order book around LTP (real depth needs broker WS — Phase 3)."""
    try:
        q = _quote_for(symbol.strip().upper() or "RELIANCE")
    except HTTPException as exc:
        raise exc
    px, spread = q["price"], max(round(q["price"] * 0.0005, 2), 0.05)
    bids = [{"price": round(px - spread * (i + 1), 2), "qty": 50 * (6 - i)} for i in range(5)]
    asks = [{"price": round(px + spread * (i + 1), 2), "qty": 50 * (i + 1)} for i in range(5)]
    return {"symbol": q["symbol"], "ltp": px, "bids": bids, "asks": asks}


@router.get("/history/{symbol}")
def history(symbol: str, tf: str = "1d", period: str = "1y",
            range: str | None = Query(default=None, alias="range")):
    """Chart history — returns LW-Charts-ready {candles:[{time,open,...}]}."""
    tf_map = {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "60m", "4h": "60m", "1d": "1d", "1wk": "1d", "1w": "1wk"}
    interval = tf_map.get(tf, "1d")
    period_map = {"1D": "5d", "1W": "1mo", "1M": "3mo", "3M": "6mo", "1Y": "1y", "ALL": "5y"}
    if range in period_map:
        period = period_map[range]
    try:
        df = fetch_candles(symbol, period=period, interval=interval)
    except (DataEngineError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    candles = [
        {"time": int(ts.timestamp()), "open": round(float(r.Open), 2),
         "high": round(float(r.High), 2), "low": round(float(r.Low), 2),
         "close": round(float(r.Close), 2), "volume": int(r.Volume or 0)}
        for ts, r in df.iterrows()
    ]
    return {"symbol": normalize_symbol(symbol), "tf": tf, "interval": interval,
            "rows": len(candles), "candles": candles}
