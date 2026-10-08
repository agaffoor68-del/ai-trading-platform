"""Technical indicator library (pure pandas — no TA-Lib dependency).

All functions take/return ``pd.Series`` (or DataFrames for multi-output
indicators) aligned to the input index. Implementations follow the classic
published formulas so they can be validated with golden tests.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

__all__ = [
    "sma",
    "ema",
    "rsi",
    "macd",
    "bollinger",
    "atr",
    "true_range",
    "supertrend",
    "vwap",
    "adx",
    "stochastic",
]


# ---------------------------------------------------------------------------
# Trend
# ---------------------------------------------------------------------------
def sma(close: pd.Series, window: int) -> pd.Series:
    return close.rolling(window).mean()


def ema(close: pd.Series, span: int) -> pd.Series:
    return close.ewm(span=span, adjust=False).mean()


def macd(
    close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9
) -> pd.DataFrame:
    macd_line = ema(close, fast) - ema(close, slow)
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return pd.DataFrame(
        {"macd": macd_line, "signal": signal_line, "hist": histogram},
        index=close.index,
    )


# ---------------------------------------------------------------------------
# Momentum
# ---------------------------------------------------------------------------
def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """Wilder's RSI."""
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    out = 100 - (100 / (1 + rs))
    # When avg_loss == 0 (no losses) RSI is 100; restore those points.
    out = out.where(avg_loss != 0, 100.0)
    out[avg_gain.isna() | avg_loss.isna()] = np.nan
    return out.rename(f"rsi_{period}")


def stochastic(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    k_period: int = 14,
    d_period: int = 3,
) -> pd.DataFrame:
    lowest = low.rolling(k_period).min()
    highest = high.rolling(k_period).max()
    denom = (highest - lowest).replace(0.0, np.nan)
    k = 100 * (close - lowest) / denom
    d = k.rolling(d_period).mean()
    return pd.DataFrame({"k": k, "d": d}, index=close.index)


# ---------------------------------------------------------------------------
# Volatility
# ---------------------------------------------------------------------------
def bollinger(
    close: pd.Series, window: int = 20, num_std: float = 2.0
) -> pd.DataFrame:
    mid = close.rolling(window).mean()
    std = close.rolling(window).std(ddof=0)
    upper = mid + num_std * std
    lower = mid - num_std * std
    bandwidth = (upper - lower) / mid
    return pd.DataFrame(
        {"mid": mid, "upper": upper, "lower": lower, "bandwidth": bandwidth},
        index=close.index,
    )


def true_range(high: pd.Series, low: pd.Series, close: pd.Series) -> pd.Series:
    prev_close = close.shift(1)
    tr = pd.concat(
        [
            (high - low).abs(),
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr


def atr(
    high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14
) -> pd.Series:
    """Wilder's ATR."""
    tr = true_range(high, low, close)
    return tr.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()


def adx(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
) -> pd.DataFrame:
    """Wilder's ADX with +DI / -DI."""
    up_move = high.diff()
    down_move = -low.diff()
    plus_dm = pd.Series(
        np.where((up_move > down_move) & (up_move > 0), up_move, 0.0), index=high.index
    )
    minus_dm = pd.Series(
        np.where((down_move > up_move) & (down_move > 0), down_move, 0.0),
        index=high.index,
    )
    atr_ = atr(high, low, close, period)
    alpha = 1 / period
    plus_di = 100 * plus_dm.ewm(alpha=alpha, adjust=False).mean() / atr_
    minus_di = 100 * minus_dm.ewm(alpha=alpha, adjust=False).mean() / atr_
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx_ = dx.ewm(alpha=alpha, adjust=False).mean()
    return pd.DataFrame(
        {"adx": adx_, "plus_di": plus_di, "minus_di": minus_di}, index=close.index
    )


# ---------------------------------------------------------------------------
# Trend-following bands
# ---------------------------------------------------------------------------
def supertrend(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 10,
    multiplier: float = 3.0,
) -> pd.DataFrame:
    """Supertrend indicator — returns trend line + direction (+1 up / -1 down)."""
    hl2 = (high + low) / 2
    atr_ = atr(high, low, close, period)
    upper = hl2 + multiplier * atr_
    lower = hl2 - multiplier * atr_

    n = len(close)
    upper_band = upper.to_numpy(dtype=float).copy()
    lower_band = lower.to_numpy(dtype=float).copy()
    direction = np.ones(n, dtype=float)
    st_line = np.full(n, np.nan)

    c = close.to_numpy(dtype=float)
    for i in range(1, n):
        if np.isnan(upper.iloc[i]) or np.isnan(lower.iloc[i]):
            continue
        # Sticky bands: tighten only when price breaks through.
        upper_band[i] = (
            upper.iloc[i]
            if (upper.iloc[i] < upper_band[i - 1] or c[i - 1] > upper_band[i - 1])
            else upper_band[i - 1]
        )
        lower_band[i] = (
            lower.iloc[i]
            if (lower.iloc[i] > lower_band[i - 1] or c[i - 1] < lower_band[i - 1])
            else lower_band[i - 1]
        )
        if direction[i - 1] == 1:
            direction[i] = -1 if c[i] < lower_band[i] else 1
        else:
            direction[i] = 1 if c[i] > upper_band[i] else -1
        st_line[i] = upper_band[i] if direction[i] == -1 else lower_band[i]

    st_line[0] = np.nan
    return pd.DataFrame(
        {"supertrend": st_line, "direction": direction}, index=close.index
    )


# ---------------------------------------------------------------------------
# Volume-weighted
# ---------------------------------------------------------------------------
def vwap(
    high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series
) -> pd.Series:
    """Session-anchored VWAP (resets whenever the date changes)."""
    typical = (high + low + close) / 3
    tp_vol = typical * volume
    dates = pd.Series(close.index.date, index=close.index)
    grp = dates.ne(dates.shift()).cumsum()
    cum_tp_vol = tp_vol.groupby(grp).cumsum()
    cum_vol = volume.groupby(grp).cumsum()
    return (cum_tp_vol / cum_vol.replace(0, np.nan)).rename("vwap")

