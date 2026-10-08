"""Global configuration for AlphaTradePro."""
from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[2]  # repo root (alphatradepro)
BACKEND_DIR = BASE_DIR / "backend"
DATA_DIR = BASE_DIR / "data"
CANDLE_DIR = DATA_DIR / "candles"

CANDLE_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
ENV = os.getenv("APP_ENV", "development")
DEBUG = ENV == "development"

# Safety: live trading is HARD-DISABLED until Phase 3 explicitly enables it.
TRADING_MODE = os.getenv("TRADING_MODE", "paper")  # "paper" | "live"
assert TRADING_MODE in ("paper", "live"), "TRADING_MODE must be paper|live"

# ---------------------------------------------------------------------------
# Market
# ---------------------------------------------------------------------------
DEFAULT_EXCHANGE_SUFFIX = ".NS"  # Yahoo Finance NSE suffix (RELIANCE -> RELIANCE.NS)
TRADING_DAYS_PER_YEAR = 252

# ---------------------------------------------------------------------------
# Backtest cost model defaults — Indian equity / F&O (approximate, configurable)
# ---------------------------------------------------------------------------
BROKERAGE_PER_ORDER_FLAT = 20.0        # ₹ per order (discount broker API plan style)
STT_EQUITY_DELIVERY_BUY = 0.001        # 0.10 %
STT_EQUITY_DELIVERY_SELL = 0.001
STT_EQUITY_INTRADAY_BUY = 0.00025
STT_EQUITY_INTRADAY_SELL = 0.00025
STT_FNO_BUY = 0.0002
STT_FNO_SELL = 0.0005
EXCHANGE_TXN_CHARGE = 0.0000345        # NSE ~0.00345 %
GST_ON_BROKERAGE = 0.18
SEBI_TURNOVER_FEE = 0.000001           # ₹10 / crore
STAMP_DUTY_BUY = 0.000015              # 0.015 % on buy side (equity)
SEBI_ORDER_RATE_LIMIT = 30             # orders/sec/client (SEBI retail algo framework)
