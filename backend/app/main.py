"""FastAPI application entrypoint.

Run:  cd backend && uvicorn app.main:app --reload
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.ai import router as ai_router
from app.api.routes import router
from app.auth import router as auth_router
from app.auth.oauth import oauth_router
from app.backtest.runs import router as backtest_runs_router
from app.market import router as market_router
from app.news import router as news_router
from app.pro import router as pro_router
from app.strategy import router as strategy_router
from app.trading.routes import router as trading_router
from app.ws import router as ws_router

app = FastAPI(
    title="AlphaTradePro",
    version=__version__,
    description=(
        "AlphaTradePro — institute-level AI trading platform for India — Yahoo Finance data, "
        "AI backtesting, indicator optimization, multi-broker execution."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only; tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(market_router)
app.include_router(backtest_runs_router)
app.include_router(news_router)
app.include_router(pro_router)
app.include_router(trading_router)
app.include_router(strategy_router)
app.include_router(ai_router)
app.include_router(ws_router)
app.include_router(router, prefix="/api")


@app.get("/")
def root() -> dict:
    return {
        "name": "alphatradepro",
        "version": __version__,
        "docs": "/docs",
        "health": "/api/health",
    }

