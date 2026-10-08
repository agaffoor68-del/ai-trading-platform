"""Backtest package."""
from app.backtest.engine import BacktestConfig, BacktestResult, CostModel, run_backtest
from app.backtest.optimize import OptimizationResult, ParamSpace, optimize
from app.backtest.strategies import STRATEGY_REGISTRY, get_strategy, register

__all__ = [
    "BacktestConfig",
    "BacktestResult",
    "CostModel",
    "run_backtest",
    "OptimizationResult",
    "ParamSpace",
    "optimize",
    "STRATEGY_REGISTRY",
    "get_strategy",
    "register",
]
