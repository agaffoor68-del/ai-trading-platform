"""Strategy registry — each strategy maps OHLCV data + params -> target signal.

A strategy returns a Series aligned to data.index with values in {1, 0, -1}
representing the desired position for the NEXT bar (executed next open by the
backtest engine — no look-ahead).
"""
from __future__ import annotations

from typing import Callable

import pandas as pd

from app.indicators import adx, bollinger, ema, macd, rsi, supertrend

SignalFn = Callable[[pd.DataFrame, dict], pd.Series]

STRATEGY_REGISTRY: dict[str, SignalFn] = {}


def register(name: str):
    def wrapper(fn: SignalFn) -> SignalFn:
        STRATEGY_REGISTRY[name] = fn
        return fn

    return wrapper


def get_strategy(name: str) -> SignalFn:
    if name not in STRATEGY_REGISTRY:
        raise KeyError(
            f"unknown strategy '{name}'. available: {sorted(STRATEGY_REGISTRY)}"
        )
    return STRATEGY_REGISTRY[name]


# ---------------------------------------------------------------------------
# Built-in strategies
# ---------------------------------------------------------------------------
@register("rsi_reversion")
def rsi_reversion(data: pd.DataFrame, params: dict) -> pd.Series:
    """Long when RSI crosses up through oversold; flat on cross down from overbought."""
    period = int(params.get("period", 14))
    os_ = float(params.get("oversold", 30))
    ob = float(params.get("overbought", 70))
    r = rsi(data["Close"], period)
    enter = (r.shift(1) < os_) & (r >= os_)  # cross UP into oversold exit zone
    exit_ = (r.shift(1) > ob) & (r <= ob)  # cross DOWN out of overbought
    state = []
    pos = 0
    for i in range(len(data)):
        if bool(enter.iloc[i]):
            pos = 1
        elif bool(exit_.iloc[i]):
            pos = 0
        state.append(pos)
    return pd.Series(state, index=data.index, dtype=int)


@register("ema_crossover")
def ema_crossover(data: pd.DataFrame, params: dict) -> pd.Series:
    """Long while fast EMA > slow EMA (dual-EMA trend filter)."""
    fast = int(params.get("fast", 20))
    slow = int(params.get("slow", 50))
    if fast >= slow:
        raise ValueError("ema_crossover: fast must be < slow")
    close = data["Close"]
    sig = (ema(close, fast) > ema(close, slow)).astype(int)
    return sig.fillna(0).astype(int)


@register("macd_trend")
def macd_trend(data: pd.DataFrame, params: dict) -> pd.Series:
    """Long while MACD line > signal line."""
    fast = int(params.get("fast", 12))
    slow = int(params.get("slow", 26))
    signal_n = int(params.get("signal", 9))
    m = macd(data["Close"], fast, slow, signal_n)
    return (m["macd"] > m["signal"]).astype(int).fillna(0)


@register("bollinger_breakout")
def bollinger_breakout(data: pd.DataFrame, params: dict) -> pd.Series:
    """Long on close above upper band; exit on close below mid-band."""
    window = int(params.get("window", 20))
    num_std = float(params.get("num_std", 2.0))
    bb = bollinger(data["Close"], window, num_std)
    close = data["Close"]
    state = []
    pos = 0
    for i in range(len(data)):
        if pd.notna(bb["upper"].iloc[i]):
            if close.iloc[i] > bb["upper"].iloc[i]:
                pos = 1
            elif close.iloc[i] < bb["mid"].iloc[i]:
                pos = 0
        state.append(pos)
    return pd.Series(state, index=data.index, dtype=int)


@register("supertrend_follow")
def supertrend_follow(data: pd.DataFrame, params: dict) -> pd.Series:
    """Long while supertrend direction == +1 (optional ADX trend filter)."""
    period = int(params.get("period", 10))
    multiplier = float(params.get("multiplier", 3.0))
    st = supertrend(data["High"], data["Low"], data["Close"], period, multiplier)
    sig = (st["direction"] == 1).astype(int)
    if params.get("adx_filter"):
        adx_n = int(params.get("adx_period", 14))
        adx_min = float(params.get("adx_min", 20))
        a = adx(data["High"], data["Low"], data["Close"], adx_n)
        sig = sig & (a["adx"] >= adx_min)
    return sig.astype(int)
