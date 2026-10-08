"""API routes — data, backtest, optimize."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app import __version__, config
from app.api.schemas import (
    BacktestRequest,
    CandlesRequest,
    HealthResponse,
    OptimizeRequest,
)
from app.backtest.engine import BacktestConfig, CostModel, run_backtest
from app.backtest.optimize import ParamSpace, optimize
from app.backtest.strategies import STRATEGY_REGISTRY, get_strategy
from app.data.yahoo import DataEngineError, data_freshness, fetch_candles

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=__version__,
        trading_mode=config.TRADING_MODE,
    )


@router.get("/strategies")
def list_strategies() -> dict:
    return {
        "strategies": sorted(STRATEGY_REGISTRY),
        "description": {
            "rsi_reversion": "Long on RSI cross-up from oversold, exit on overbought cross-down",
            "ema_crossover": "Long while fast EMA > slow EMA",
            "macd_trend": "Long while MACD > signal line",
            "bollinger_breakout": "Long on close > upper band, exit below mid band",
            "supertrend_follow": "Long while supertrend direction is +1 (optional ADX filter)",
        },
    }


@router.post("/data/candles")
def candles(req: CandlesRequest) -> dict:
    try:
        df = fetch_candles(
            req.symbol,
            period=req.period,
            interval=req.interval,
            refresh=req.refresh,
        )
    except (DataEngineError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    out = df.reset_index()
    out["Date"] = out["Date"].dt.strftime("%Y-%m-%d")
    return {
        "symbol": req.symbol,
        "interval": req.interval,
        "rows": len(out),
        "candles": out.to_dict(orient="records"),
        "freshness": data_freshness(req.symbol, req.interval),
    }


@router.post("/backtest")
def backtest(req: BacktestRequest) -> dict:
    try:
        get_strategy(req.strategy)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        data = fetch_candles(req.symbol, period=req.period, interval=req.interval,
                             start=req.start, end=req.end)
    except (DataEngineError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    try:
        signal = get_strategy(req.strategy)(data, req.params)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"invalid params: {exc}") from exc

    cfg = BacktestConfig(
        initial_capital=req.initial_capital,
        allow_short=req.allow_short,
        cost_model=CostModel(slippage_bps=req.slippage_bps),
    )
    result = run_backtest(data, signal, cfg)
    return {
        "symbol": req.symbol,
        "strategy": req.strategy,
        "params": req.params,
        "metrics": result.metrics,
        "n_trades": len(result.trades),
        "trades": [
            {
                "side": t.side,
                "qty": t.qty,
                "entry_time": str(t.entry_time.date()),
                "exit_time": None if t.exit_time is None else str(t.exit_time.date()),
                "entry_price": round(t.entry_price, 2),
                "exit_price": None if t.exit_price is None else round(t.exit_price, 2),
                "pnl": round(t.pnl, 2),
                "return_pct": round(t.return_pct * 100, 3),
                "costs": round(t.costs, 2),
            }
            for t in result.trades
        ],
        "equity_curve": [
            {"date": str(ts.date()), "equity": round(float(v), 2)}
            for ts, v in result.equity.items()
        ],
        "config": result.config_snapshot,
    }


@router.post("/optimize")
def optimize_route(req: OptimizeRequest) -> dict:
    try:
        get_strategy(req.strategy)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        data = fetch_candles(req.symbol, period=req.period, interval=req.interval)
    except (DataEngineError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Integer ranges get int hints (indicators need ints), floats stay floats.
    space = ParamSpace()
    for name, rng in req.space.items():
        if float(rng.low).is_integer() and float(rng.high).is_integer():
            space.ints[name] = (int(rng.low), int(rng.high))
        else:
            space.floats[name] = (float(rng.low), float(rng.high))

    cfg = BacktestConfig(initial_capital=req.initial_capital)
    try:
        result = optimize(
            data,
            req.strategy,
            space,
            cfg=cfg,
            n_trials=req.n_trials,
            n_splits=req.n_splits,
            metric=req.metric,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "symbol": req.symbol,
        "strategy": req.strategy,
        "best_params": result.best_params,
        "best_train_objective": result.best_train_objective,
        "oos_mean_metrics": result.oos_mean,
        "oos_fold_metrics": result.oos_metrics,
        "n_trials": result.n_trials,
        "n_splits": result.n_splits,
        "metric": req.metric,
        "note": "Train objective = stability-adjusted mean across folds; "
        "oos_mean_metrics = out-of-sample aggregate on held-out test blocks.",
    }
