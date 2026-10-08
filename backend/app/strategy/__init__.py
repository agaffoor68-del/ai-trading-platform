"""Strategy registry API — list/create/deploy (Phase 1 engine ke upar)."""
from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.backtest.strategies import STRATEGY_REGISTRY

router = APIRouter(prefix="/api/strategy", tags=["strategy"])

_CREATED: list[dict] = []
_DEPLOYED: dict[str, dict] = {}


class CreateBody(BaseModel):
    name: str
    base: str = "ema_crossover"
    params: dict = {}
    description: str = ""
    code: str | None = None
    explanation: str | None = None


@router.get("/list")
def strategy_list():
    builtin = [{"id": k, "name": k, "kind": "builtin", "params": {},
                "status": "paper" if k in _DEPLOYED else "draft",
                "win_rate": 0.0, "sharpe": 0.0} for k in sorted(STRATEGY_REGISTRY)]
    custom = [{**c, "status": "paper" if c["id"] in _DEPLOYED else "draft",
               "win_rate": 0.0, "sharpe": 0.0} for c in _CREATED]
    return {"strategies": builtin + custom}


@router.post("/create")
def strategy_create(body: CreateBody):
    base = body.base or "ema_crossover"
    if base not in STRATEGY_REGISTRY:
        raise HTTPException(status_code=400, detail=f"unknown base {base}")
    item = {"id": f"custom-{uuid.uuid4().hex[:6]}", "name": body.name,
            "kind": "custom", "base": base, "params": body.params,
            "description": body.description or body.explanation or "",
            "code": body.code or "", "created": time.strftime("%Y-%m-%d %H:%M")}
    _CREATED.append(item)
    return item


class DeployBody(BaseModel):
    target: str = "paper"
    mode: str | None = None


class DeployCompatBody(BaseModel):
    """Dashboard quick-deploy sends {symbol, target} — no strategy id in path."""
    symbol: str | None = None
    strategy: str | None = None
    target: str = "paper"
    mode: str | None = None


@router.post("/deploy")
def strategy_deploy_compat(body: DeployCompatBody | None = None):
    sid = (body.symbol if body and body.symbol else None) or \
        (body.strategy if body and body.strategy else None) or "ema_crossover"
    mode = (body.mode if body and body.mode else None) or \
        (body.target if body else "paper") or "paper"
    if mode == "live":
        raise HTTPException(status_code=423, detail="Live deploy Phase 3 me. Paper pe deploy karein.")
    _DEPLOYED[sid] = {"strategy": sid, "mode": "paper", "at": time.strftime("%Y-%m-%d %H:%M:%S")}
    return {"ok": True, "deployment": _DEPLOYED[sid]}


@router.post("/{sid}/deploy")
def strategy_deploy(sid: str, body: DeployBody | None = None):
    mode = (body.mode if body and body.mode else None) or (body.target if body else "paper")
    if mode == "live":
        raise HTTPException(status_code=423, detail="Live deploy Phase 3 me. Paper pe deploy karein.")
    _DEPLOYED[sid] = {"strategy": sid, "mode": "paper", "at": time.strftime("%Y-%m-%d %H:%M:%S")}
    return {"ok": True, "deployment": _DEPLOYED[sid]}
