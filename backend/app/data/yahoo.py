"""Data collection engine — Yahoo Finance (yfinance) with local CSV cache.

Design:
- ``fetch_candles`` downloads OHLCV candles and caches them under
  ``data/candles/{symbol}_{interval}.csv``.
- Subsequent calls only fetch the missing tail (incremental update).
- Optional symbols are auto-suffixed with ``.NS`` for NSE equities unless
  they already contain a dot (e.g. indices like ``^NSEI``).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf

from app.config import CANDLE_DIR, DEFAULT_EXCHANGE_SUFFIX

logger = logging.getLogger(__name__)

# Canonical OHLCV column order used across the platform.
COLUMNS = ["Open", "High", "Low", "Close", "Volume"]


class DataEngineError(RuntimeError):
    """Raised when market data cannot be fetched."""


def normalize_symbol(symbol: str) -> str:
    """Append NSE suffix when the symbol has no exchange qualifier."""
    symbol = symbol.strip().upper()
    if not symbol:
        raise ValueError("symbol must be non-empty")
    if "." in symbol or symbol.startswith("^"):
        return symbol
    return f"{symbol}{DEFAULT_EXCHANGE_SUFFIX}"


def _cache_path(symbol: str, interval: str) -> Path:
    safe = symbol.replace("^", "_idx_").replace(".", "_")
    return CANDLE_DIR / f"{safe}_{interval}.csv"


def _read_cache(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    df = pd.read_csv(path, parse_dates=["Date"], index_col="Date")
    if df.empty:
        return None
    return df


def _write_cache(df: pd.DataFrame, path: Path) -> None:
    df.to_csv(path)


def fetch_candles(
    symbol: str,
    period: str = "2y",
    interval: str = "1d",
    start: str | None = None,
    end: str | None = None,
    use_cache: bool = True,
    refresh: bool = False,
) -> pd.DataFrame:
    """Fetch OHLCV candles for *symbol* from Yahoo Finance.

    Parameters
    ----------
    symbol   : trading symbol, e.g. ``RELIANCE`` or ``RELIANCE.NS`` / ``^NSEI``
    period   : yfinance period (1mo,6mo,1y,2y,5y,max) — ignored if start/end given
    interval  : 1m,5m,15m,1h,1d,1wk,1mo
    start/end: explicit date range (YYYY-MM-DD)
    use_cache: read/write local CSV cache
    refresh   : bypass existing cache entirely and re-download

    Returns
    -------
    DataFrame indexed by Date with columns Open, High, Low, Close, Volume.
    """
    ysymbol = normalize_symbol(symbol)
    path = _cache_path(ysymbol, interval)

    cached = None
    if use_cache and not refresh:
        cached = _read_cache(path)

    # Try incremental update when we already have some history.
    if cached is not None and not cached.empty and use_cache and not refresh:
        last_date = cached.index.max()
        try:
            tail = yf.download(
                ysymbol,
                start=(last_date + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
                end=end,
                interval=interval,
                progress=False,
                auto_adjust=True,
            )
        except Exception as exc:  # network failure → fall back to cache
            logger.warning("yfinance incremental fetch failed (%s); using cache", exc)
            tail = pd.DataFrame()
        if tail is not None and not tail.empty:
            if isinstance(tail.columns, pd.MultiIndex):
                tail.columns = tail.columns.get_level_values(0)
            cached = pd.concat([cached, tail[COLUMNS]])
        result = cached
    else:
        kwargs: dict = {"interval": interval, "progress": False, "auto_adjust": True}
        if start and end:
            kwargs.update(start=start, end=end)
        else:
            kwargs["period"] = period
        try:
            raw = yf.download(ysymbol, **kwargs)
        except Exception as exc:
            raise DataEngineError(f"yfinance download failed for {ysymbol}: {exc}") from exc
        if raw is None or raw.empty:
            raise DataEngineError(f"no data returned for {ysymbol}")
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)
        result = raw[COLUMNS].dropna(how="all")

    # Normalize index/timezone: naive datetimes for cache stability.
    result.index = pd.to_datetime(result.index).tz_localize(None)
    result = result[~result.index.duplicated(keep="last")].sort_index()
    result = result.astype(float)

    if use_cache:
        _write_cache(result, path)
    logger.info("loaded %d candles for %s (%s)", len(result), ysymbol, interval)
    return result


def data_freshness(symbol: str, interval: str = "1d") -> dict:
    """Return cache metadata for a symbol (used by API health endpoints)."""
    path = _cache_path(normalize_symbol(symbol), interval)
    if not path.exists():
        return {"symbol": symbol, "cached": False}
    df = _read_cache(path)
    return {
        "symbol": normalize_symbol(symbol),
        "cached": True,
        "rows": 0 if df is None else len(df),
        "first": None if df is None or df.empty else str(df.index.min().date()),
        "last": None if df is None or df.empty else str(df.index.max().date()),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
