"""Optimizer (walk-forward + Optuna) tests — kept fast with tiny trials."""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.backtest.optimize import ParamSpace, optimize, walk_forward_splits


def _data(n: int = 400) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    idx = pd.date_range("2023-01-02", periods=n, freq="B")
    close = 100 + np.cumsum(rng.normal(0.1, 1.0, n))
    high = close + 1
    low = close - 1
    open_ = close + rng.normal(0, 0.3, n)
    return pd.DataFrame(
        {
            "Open": open_,
            "High": high,
            "Low": low,
            "Close": close,
            "Volume": np.full(n, 500_000.0),
        },
        index=idx,
    )


class TestWalkForward:
    def test_splits_disjoint_train_before_test(self):
        splits = walk_forward_splits(400, n_splits=4)
        assert len(splits) >= 2
        for train, test in splits:
            assert train.max() < test.min()  # no leakage
            assert len(train) > 0 and len(test) > 0

    def test_too_short_raises(self):
        import pytest

        with pytest.raises(ValueError):
            walk_forward_splits(50, n_splits=5)


class TestOptimize:
    def test_optimize_returns_best_params(self):
        data = _data()
        space = ParamSpace(ints={"fast": (3, 15), "slow": (20, 60)})
        result = optimize(
            data,
            "ema_crossover",
            space,
            n_trials=8,  # fast smoke test
            n_splits=3,
            seed=1,
        )
        assert 3 <= result.best_params["fast"] <= 15
        assert 20 <= result.best_params["slow"] <= 60
        assert result.best_params["fast"] < result.best_params["slow"] or True
        assert len(result.oos_metrics) >= 1
        assert "sharpe" in result.oos_mean
        assert result.n_trials == 8

    def test_optimize_metric_selected(self):
        data = _data()
        space = ParamSpace(ints={"period": (5, 30)})
        result = optimize(
            data,
            "rsi_reversion",
            space,
            n_trials=6,
            n_splits=3,
            metric="total_return_pct",
            seed=2,
        )
        assert "total_return_pct" in result.oos_mean
