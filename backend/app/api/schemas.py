"""API request/response schemas."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class CandlesRequest(BaseModel):
    symbol: str = Field(..., examples=["RELIANCE"], description="NSE symbol, .NS auto-appended")
    period: str = Field("2y", description="yfinance period: 6mo,1y,2y,5y,max")
    interval: str = Field("1d", description="1m,5m,15m,1h,1d,1wk")
    refresh: bool = False


class BacktestRequest(BaseModel):
    symbol: str = Field(..., examples=["NIFTY50.NS"])
    strategy: str = Field(..., examples=["ema_crossover"])
    params: dict[str, Any] = Field(default_factory=dict)
    period: str = "2y"
    interval: str = "1d"
    start: str | None = Field(default=None, description="YYYY-MM-DD (overrides period)")
    end: str | None = Field(default=None, description="YYYY-MM-DD")
    initial_capital: float = Field(100_000.0, gt=0)
    allow_short: bool = False
    slippage_bps: float = Field(5.0, ge=0)


class ParamRange(BaseModel):
    low: float
    high: float


class OptimizeRequest(BaseModel):
    symbol: str
    strategy: str
    # e.g. {"fast": {"low": 5, "high": 50}, "slow": {"low": 30, "high": 200}}
    space: dict[str, ParamRange]
    period: str = "3y"
    interval: str = "1d"
    n_trials: int = Field(40, ge=1, le=500)
    n_splits: int = Field(5, ge=2, le=10)
    metric: Literal["sharpe", "total_return_pct", "sortino", "profit_factor"] = "sharpe"
    initial_capital: float = Field(100_000.0, gt=0)


class HealthResponse(BaseModel):
    status: str
    version: str
    trading_mode: str
