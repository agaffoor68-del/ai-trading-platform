"""Spec-shape backtest run store — POST /api/backtest/run, GET list/{id}."""
from __future__ import annotations

import logging
import time
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.routes import backtest as run_engine_backtest
from app.api.schemas import BacktestRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/backtest", tags=["backtest"])

_RUNS: dict[str, dict] = {}


class RunBody(BaseModel):
    symbol: str = "RELIANCE"
    strategy: str = "ema_crossover"
    params: dict = {}
    period: str = "2y"
    start: str | None = None
    end: str | None = None
    initial_capital: float = 100000.0


@router.post("/run")
def run(body: RunBody):
    req = BacktestRequest(symbol=body.symbol, strategy=body.strategy,
                          params=body.params, period=body.period,
                          initial_capital=body.initial_capital)
    try:
        result = run_engine_backtest(req)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    rid = uuid.uuid4().hex[:10]
    _RUNS[rid] = {"id": rid, **result, "created": time.strftime("%Y-%m-%d %H:%M:%S")}
    return {"id": rid, **result}


@router.get("/list")
def list_runs():
    return {"runs": [{"id": r["id"], "symbol": r["symbol"], "strategy": r["strategy"],
                      "created": r.get("created", ""), "n_trades": r.get("n_trades", 0),
                      "metrics": r.get("metrics", {})} for r in _RUNS.values()]}


@router.get("/{rid}")
def get_run(rid: str):
    if rid not in _RUNS:
        raise HTTPException(status_code=404, detail="backtest run not found")
    return _RUNS[rid]


@router.get("/{rid}/export")
def export_run(rid: str):
    import csv
    import io

    from fastapi import Response
    if rid not in _RUNS:
        raise HTTPException(status_code=404, detail="backtest run not found")
    buf = io.StringIO()
    trades = _RUNS[rid].get("trades", [])
    w = csv.DictWriter(buf, fieldnames=["side", "qty", "entry_time", "exit_time",
                                        "entry_price", "exit_price", "pnl", "return_pct", "costs"])
    w.writeheader()
    for t in trades:
        w.writerow(t)
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=backtest_{rid}.csv"})
