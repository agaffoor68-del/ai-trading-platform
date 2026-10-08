"""Golden-value tests for technical indicators.

Validated against known reference values computed by hand / established libs.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.indicators import (
    adx,
    atr,
    bollinger,
    ema,
    macd,
    rsi,
    sma,
    stochastic,
    supertrend,
    true_range,
    vwap,
)


def _make_ohlcv(n: int = 200, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    close = 100 + np.cumsum(rng.normal(0, 1, n))
    high = close + rng.uniform(0.2, 1.5, n)
    low = close - rng.uniform(0.2, 1.5, n)
    open_ = close + rng.normal(0, 0.5, n)
    vol = rng.integers(100_000, 500_000, n).astype(float)
    idx = pd.date_range("2024-01-01", periods=n, freq="B")
    return pd.DataFrame(
        {"Open": open_, "High": high, "Low": low, "Close": close, "Volume": vol},
        index=idx,
    )


class TestSMAEMA:
    def test_sma_constant(self):
        s = pd.Series([5.0] * 10)
        out = sma(s, 3)
        assert out.iloc[-1] == pytest.approx(5.0)

    def test_sma_known_value(self):
        s = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
        out = sma(s, 3)
        assert out.iloc[2] == pytest.approx(2.0)
        assert out.iloc[4] == pytest.approx(4.0)

    def test_ema_close_to_sma_on_flat(self):
        s = pd.Series([10.0] * 50)
        assert ema(s, 10).iloc[-1] == pytest.approx(10.0)

    def test_ema_follows_trend(self):
        s = pd.Series(np.arange(1, 101, dtype=float))
        e = ema(s, 10)
        assert e.iloc[-1] > e.iloc[50]  # rising series → EMA rising


class TestRSI:
    def test_rsi_all_gains_is_100(self):
        s = pd.Series(np.arange(1, 51, dtype=float))
        out = rsi(s, 14)
        assert out.iloc[-1] == pytest.approx(100.0)

    def test_rsi_bounds(self):
        df = _make_ohlcv()
        out = rsi(df["Close"], 14).dropna()
        assert (out >= 0).all() and (out <= 100).all()

    def test_rsi_warmup_nan(self):
        df = _make_ohlcv(50)
        out = rsi(df["Close"], 14)
        assert out.iloc[0] != out.iloc[0]  # NaN at start


class TestMACD:
    def test_macd_hist_consistency(self):
        df = _make_ohlcv()
        m = macd(df["Close"])
        assert np.allclose(
            m["hist"].to_numpy(), (m["macd"] - m["signal"]).to_numpy(), equal_nan=True
        )

    def test_macd_flat_series_zero(self):
        s = pd.Series([50.0] * 100)
        m = macd(s)
        assert m["macd"].iloc[-1] == pytest.approx(0.0, abs=1e-9)


class TestBollinger:
    def test_bands_ordered(self):
        df = _make_ohlcv()
        bb = bollinger(df["Close"], 20, 2.0).dropna()
        assert (bb["upper"] >= bb["mid"]).all()
        assert (bb["mid"] >= bb["lower"]).all()

    def test_known_std(self):
        s = pd.Series([2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0])
        # rolling window 8 (full): population std of {2,4,4,4,5,5,7,9} = 2.0
        bb = bollinger(s, 8, 2.0)
        assert bb["upper"].iloc[-1] == pytest.approx(bb["mid"].iloc[-1] + 4.0)


class TestATR:
    def test_true_range_high_low_only_first_bar(self):
        h = pd.Series([10.0, 12.0, 11.0])
        lo = pd.Series([8.0, 9.0, 10.0])
        c = pd.Series([9.0, 11.0, 10.5])
        tr = true_range(h, lo, c)
        assert tr.iloc[0] == pytest.approx(2.0)  # H-L on first bar

    def test_atr_positive(self):
        df = _make_ohlcv()
        out = atr(df["High"], df["Low"], df["Close"], 14).dropna()
        assert (out > 0).all()


class TestSupertrend:
    def test_direction_flip_on_trend(self):
        n = 100
        up = np.linspace(100, 150, n)  # steady uptrend
        idx = pd.date_range("2024-01-01", periods=n, freq="B")
        high = pd.Series(up + 1, index=idx)
        low = pd.Series(up - 1, index=idx)
        close = pd.Series(up, index=idx)
        st = supertrend(high, low, close, period=10, multiplier=3.0)
        assert st["direction"].iloc[-1] == 1
        assert (st["direction"].iloc[30:] == 1).all()


class TestStochasticADX:
    def test_stoch_bounds(self):
        df = _make_ohlcv()
        st = stochastic(df["High"], df["Low"], df["Close"]).dropna()
        valid = st.dropna()
        assert (valid["k"] >= 0).all() and (valid["k"] <= 100).all()

    def test_adx_range(self):
        df = _make_ohlcv()
        a = adx(df["High"], df["Low"], df["Close"]).dropna()
        ok = a["adx"].dropna()
        assert (ok >= 0).all() and (ok <= 100).all()


class TestVWAP:
    def test_vwap_single_session(self):
        n = 10
        idx = pd.date_range("2024-03-04 09:15", periods=n, freq="5min")
        h = pd.Series([101.0] * n, index=idx)
        lo = pd.Series([99.0] * n, index=idx)
        c = pd.Series([100.0] * n, index=idx)
        v = pd.Series([1000.0] * n, index=idx)
        out = vwap(h, lo, c, v)
        # typical price constant 100 → vwap constant 100
        assert out.iloc[-1] == pytest.approx(100.0)

    def test_vwap_resets_daily(self):
        idx1 = pd.date_range("2024-03-04 09:15", periods=5, freq="5min")
        idx2 = pd.date_range("2024-03-05 09:15", periods=5, freq="5min")
        idx = idx1.append(idx2)
        c = pd.Series([100.0, 100.0, 100.0, 100.0, 100.0, 200.0, 200.0, 200.0, 200.0, 200.0], index=idx)
        h, lo, v = c + 1, c - 1, pd.Series(1000.0, index=idx)
        out = vwap(h, lo, c, v)
        assert out.iloc[5] == pytest.approx(200.0)  # day-2 reset, not blended
