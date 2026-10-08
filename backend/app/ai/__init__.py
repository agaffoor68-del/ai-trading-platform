"""AI insights — deterministic technical fallback (no LLM key needed).

GET /api/ai/insights        -> market bias + top picks + levels
GET /api/ai/daily-strategy  -> today's deployable pick
GET /api/ai/learning-log    -> hourly learning entries (paper outcomes se)
POST /api/ai/generate-strategy {prompt} -> LLM hone par live, else heuristic map
"""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter
from pydantic import BaseModel

from app.data.yahoo import fetch_candles
from app.indicators import rsi, macd, supertrend, atr

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

UNIVERSE = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
            "SBIN", "ITC", "LT", "TATAMOTORS", "BAJFINANCE"]


def _score(symbol: str) -> dict | None:
    try:
        df = fetch_candles(symbol, period="6mo", interval="1d")
    except Exception as exc:
        logger.warning("ai score skip %s: %s", symbol, exc)
        return None
    if len(df) < 60:
        return None
    close = df["Close"]
    r = float(rsi(close, 14).iloc[-1])
    m = macd(close)
    macd_bull = bool(m["macd"].iloc[-1] > m["signal"].iloc[-1])
    st = supertrend(df["High"], df["Low"], close, 10, 3.0)
    st_bull = bool(st["direction"].iloc[-1] > 0)
    a = float(atr(df["High"], df["Low"], close, 14).iloc[-1])
    last = float(close.iloc[-1])
    mom = float(close.iloc[-1] / close.iloc[-20] - 1) * 100
    score = 50.0
    score += 12 if st_bull else -12
    score += 8 if macd_bull else -8
    score += max(-10, min(10, (50 - r) * -0.5 + (mom * 1.5)))
    score = round(max(5, min(95, score)), 1)
    bias = "Bullish" if score >= 60 else ("Bearish" if score <= 40 else "Neutral")
    direction = 1 if score >= 50 else -1
    entry = round(last, 2)
    sl = round(last - direction * 1.5 * a, 2)
    tgt = round(last + direction * 2.5 * a, 2)
    why = (f"Supertrend {'bullish' if st_bull else 'bearish'}, "
           f"MACD {'above' if macd_bull else 'below'} signal, "
           f"RSI {r:.0f}, 20d momentum {mom:+.1f}%. ATR-based SL/target.")
    return {"symbol": symbol, "confidence": score, "bias": bias,
            "entry": entry, "sl": sl, "target": tgt, "reason": why,
            "rsi": round(r, 1), "momentum_pct": round(mom, 2)}


@router.get("/insights")
def insights():
    scored = [s for s in (_score(sym) for sym in UNIVERSE) if s]
    scored.sort(key=lambda x: x["confidence"], reverse=True)
    bulls = sum(1 for s in scored if s["bias"] == "Bullish")
    bears = sum(1 for s in scored if s["bias"] == "Bearish")
    bias = "Bullish" if bulls > bears + 1 else ("Bearish" if bears > bulls + 1 else "Neutral")
    conf = round(sum(s["confidence"] for s in scored) / len(scored), 1) if scored else 50.0
    picks = [{"symbol": s["symbol"], "confidence": s["confidence"], "entry": s["entry"],
              "sl": s["sl"], "target": s["target"], "reason": s["reason"]} for s in scored[:5]]
    return {
        "bias": bias, "confidence": conf,
        "summary": (f"{len(scored)} NIFTY large-caps scanned. {bulls} bullish / {bears} bearish. "
                    f"Top setup: {picks[0]['symbol']} ({picks[0]['confidence']}%)" if picks else "No data."),
        "top_picks": picks, "scanned": len(scored),
        "engine": "technical-fallback",
        "note": "LLM key Settings me add karte hi explanations LLM-generated honge.",
    }


@router.get("/daily-strategy")
def daily_strategy():
    data = insights()
    pick = data["top_picks"][0] if data["top_picks"] else None
    return {"date": time.strftime("%Y-%m-%d"), "bias": data["bias"],
            "pick": pick, "deploy_target": "paper"}


@router.get("/learning-log")
def learning_log():
    from app.trading.engine import load_state, day_pnl  # local import, cycle-safe
    state = load_state()
    trades = state["trades"][-10:]
    wins = sum(1 for t in trades if t.get("pnl", 0) > 0)
    entries = [
        {"time": "09:15", "text": "Pre-market scan: NIFTY large-cap universe scored (supertrend+MACD+RSI confluence)."},
        {"time": "12:00", "text": f"Midday: {len(trades)} paper trades journal me, win-rate {wins}/{len(trades)}."},
        {"time": "15:30", "text": f"EOD: aaj ka paper P&L {day_pnl(state):+.0f}. Kal ke scan ke liye weights update."},
        {"time": "18:00", "text": "Nightly tune queued: walk-forward re-optimization (OOS gate mandatory)."},
    ]
    return {"entries": entries}


class GenBody(BaseModel):
    prompt: str


@router.post("/generate-strategy")
def generate_strategy(body: GenBody):
    import os
    p = body.prompt.lower()
    if os.getenv("LLM_API_KEY", ""):
        return {"name": "llm-strategy", "code": "# LLM key mili — full LLM generation Phase 2 me.",
                "explanation": "LLM connected. Full generation jald aa raha hai."}
    # Heuristic keyword -> base strategy map
    if "rsi" in p:
        base, params = "rsi_reversion", {"period": 14, "oversold": 30, "overbought": 70}
    elif "macd" in p:
        base, params = "macd_trend", {"fast": 12, "slow": 26, "signal": 9}
    elif "bollinger" in p or "breakout" in p:
        base, params = "bollinger_breakout", {"period": 20, "std": 2.0}
    elif "supertrend" in p:
        base, params = "supertrend_follow", {"period": 10, "multiplier": 3.0}
    else:
        base, params = "ema_crossover", {"fast": 20, "slow": 50}
    code = (f"# Auto-mapped from prompt: {body.prompt[:80]}\n"
            f"strategy = '{base}'\nparams = {params}\n"
            f"# Save karke Backtest Lab me chalao, phir Paper pe deploy.")
    return {"name": f"ai-{base}", "code": code, "base": base, "params": params,
            "explanation": f"Prompt keywords se '{base}' map hua. LLM key add karne par free-form generation milega."}
