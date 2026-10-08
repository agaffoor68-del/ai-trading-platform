"""Strategy parameter optimization — Optuna with walk-forward validation.

Walk-forward protocol (anti-overfitting):
1. Split data into ``n_splits`` contiguous (train, test) blocks.
2. For each trial, params are evaluated on EVERY train block; objective =
   mean train Sharpe (stability across time, not one lucky period).
3. Best params are then evaluated once on each TEST block (out-of-sample);
   reported metrics = aggregate of OOS results.

This gives a realistic "best indicator settings" answer instead of a
curve-fit one.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

from app.backtest.engine import BacktestConfig, run_backtest
from app.backtest.strategies import get_strategy

try:
    import optuna

    optuna.logging.set_verbosity(optuna.logging.WARNING)
except ImportError:  # pragma: no cover
    optuna = None


@dataclass
class ParamSpace:
    """Search space: name -> (low, high) ints for suggest_int."""

    ints: dict[str, tuple[int, int]] = field(default_factory=dict)
    floats: dict[str, tuple[float, float]] = field(default_factory=dict)
    categoricals: dict[str, list[Any]] = field(default_factory=dict)


@dataclass
class OptimizationResult:
    best_params: dict
    best_train_objective: float
    oos_metrics: list[dict]
    oos_mean: dict
    n_trials: int
    n_splits: int
    search_space: dict


def walk_forward_splits(
    n: int, n_splits: int, train_frac: float = 0.7
) -> list[tuple[np.ndarray, np.ndarray]]:
    """Contiguous expanding/rolling splits — returns list of (train_idx, test_idx)."""
    if n_splits < 2:
        raise ValueError("n_splits must be >= 2")
    block = n // n_splits
    splits = []
    for i in range(n_splits):
        start = i * block
        end = n if i == n_splits - 1 else (i + 1) * block
        if end - start < 30:
            continue
        sub = end - start
        cut = start + int(sub * train_frac)
        if cut - start < 20 or end - cut < 10:
            continue
        splits.append((np.arange(start, cut), np.arange(cut, end)))
    if not splits:
        raise ValueError("data too short for the requested walk-forward splits")
    return splits


def _evaluate(
    data: pd.DataFrame,
    strategy_name: str,
    params: dict,
    idx: np.ndarray,
    cfg: BacktestConfig,
) -> dict:
    sub = data.iloc[idx]
    fn = get_strategy(strategy_name)
    sig = fn(sub, params)
    res = run_backtest(sub, sig, cfg)
    return res.metrics


def optimize(
    data: pd.DataFrame,
    strategy_name: str,
    space: ParamSpace,
    cfg: BacktestConfig | None = None,
    n_trials: int = 60,
    n_splits: int = 5,
    seed: int = 42,
    metric: str = "sharpe",
) -> OptimizationResult:
    """Find best *strategy* params via Optuna + walk-forward validation."""
    if optuna is None:
        raise RuntimeError("optuna not installed — pip install optuna")
    cfg = cfg or BacktestConfig()
    splits = walk_forward_splits(len(data), n_splits)
    train_idx_all = [t for t, _ in splits]

    def objective(trial: "optuna.Trial") -> float:
        params: dict = {}
        for name, (lo, hi) in space.ints.items():
            params[name] = trial.suggest_int(name, lo, hi)
        for name, (lo, hi) in space.floats.items():
            params[name] = trial.suggest_float(name, lo, hi)
        for name, choices in space.categoricals.items():
            params[name] = trial.suggest_categorical(name, choices)

        scores = []
        for idx in train_idx_all:
            try:
                m = _evaluate(data, strategy_name, params, idx, cfg)
            except Exception:
                return -1e9  # invalid param combo
            value = m.get(metric, 0.0)
            if value is None or not np.isfinite(value):
                value = -1e9 if value is not None and value < 0 else 0.0
            scores.append(value)
        # Stability penalty: reward consistency across folds.
        mean = float(np.mean(scores))
        return mean - 0.1 * float(np.std(scores))

    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=seed),
    )
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    best = dict(study.best_params)

    # Out-of-sample evaluation on held-out test blocks.
    oos_metrics = [
        _evaluate(data, strategy_name, best, test_idx, cfg)
        for _, test_idx in splits
    ]
    numeric_keys = [
        k
        for k, v in oos_metrics[0].items()
        if isinstance(v, (int, float)) and k != "final_equity"
    ]
    oos_mean = {
        k: round(float(np.mean([m[k] for m in oos_metrics])), 3)
        for k in numeric_keys
    }

    return OptimizationResult(
        best_params=best,
        best_train_objective=round(float(study.best_value), 3),
        oos_metrics=oos_metrics,
        oos_mean=oos_mean,
        n_trials=n_trials,
        n_splits=len(splits),
        search_space={
            "ints": space.ints,
            "floats": space.floats,
            "categoricals": space.categoricals,
        },
    )
