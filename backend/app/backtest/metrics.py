"""Performance metrics for backtest results."""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from app.config import TRADING_DAYS_PER_YEAR


def max_drawdown(equity: pd.Series) -> float:
    """Maximum peak-to-trough drawdown (negative fraction, e.g. -0.23)."""
    running_max = equity.cummax()
    dd = equity / running_max - 1.0
    return float(dd.min()) if len(dd) else 0.0


def sharpe_ratio(
    returns: pd.Series, risk_free_rate: float = 0.06, periods_per_year: int = TRADING_DAYS_PER_YEAR
) -> float:
    if returns.std(ddof=0) == 0 or len(returns) < 2:
        return 0.0
    excess = returns - risk_free_rate / periods_per_year
    return float(
        math.sqrt(periods_per_year) * excess.mean() / excess.std(ddof=0)
    )


def sortino_ratio(
    returns: pd.Series, risk_free_rate: float = 0.06, periods_per_year: int = TRADING_DAYS_PER_YEAR
) -> float:
    excess = returns - risk_free_rate / periods_per_year
    downside = excess[excess < 0]
    if len(downside) < 1 or downside.std(ddof=0) == 0:
        return 0.0
    dstd = math.sqrt((downside**2).mean())
    if dstd == 0:
        return 0.0
    return float(math.sqrt(periods_per_year) * excess.mean() / dstd)


def compute_metrics(
    equity: pd.Series,
    returns: pd.Series,
    trades: list,
    initial_capital: float,
    risk_free_rate: float,
    total_costs: float,
) -> dict:
    final = float(equity.iloc[-1]) if len(equity) else initial_capital
    total_return = final / initial_capital - 1.0

    n_bars = len(returns)
    years = n_bars / TRADING_DAYS_PER_YEAR if n_bars else 0.0
    cagr = (
        (final / initial_capital) ** (1 / years) - 1.0
        if years > 0 and final > 0 and initial_capital > 0
        else 0.0
    )

    pnls = [t.pnl for t in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]
    gross_win = sum(wins)
    gross_loss = abs(sum(losses))

    return {
        "final_equity": round(final, 2),
        "total_return_pct": round(total_return * 100, 3),
        "cagr_pct": round(cagr * 100, 3),
        "sharpe": round(sharpe_ratio(returns, risk_free_rate), 3),
        "sortino": round(sortino_ratio(returns, risk_free_rate), 3),
        "max_drawdown_pct": round(max_drawdown(equity) * 100, 3),
        "n_trades": len(trades),
        "win_rate_pct": round(100 * len(wins) / len(trades), 2) if trades else 0.0,
        "profit_factor": round(gross_win / gross_loss, 3)
        if gross_loss > 0
        else (math.inf if gross_win > 0 else 0.0),
        "avg_trade_pnl": round(float(np.mean(pnls)), 2) if pnls else 0.0,
        "expectancy": round(float(np.mean(pnls)), 2) if pnls else 0.0,
        "best_trade_pnl": round(max(pnls), 2) if pnls else 0.0,
        "worst_trade_pnl": round(min(pnls), 2) if pnls else 0.0,
        "total_costs": round(total_costs, 2),
        "volatility_annual_pct": round(
            float(returns.std(ddof=0) * math.sqrt(TRADING_DAYS_PER_YEAR) * 100), 3
        ),
    }
