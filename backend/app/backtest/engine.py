"""Backtest engine — event-driven, vectorized entry/exit with Indian cost model.

Assumptions (documented, configurable):
- Signals generated on bar close are executed on the NEXT bar's open
  (no look-ahead bias).
- One position at a time (long/flat/short) — portfolio overlay comes later.
- Position sizing: whole-share of available cash at entry.
- Costs: flat brokerage per order + percentage charges (STT, exchange txn,
  GST, SEBI turnover) + stamp duty on buys + slippage in basis points.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from app import config


@dataclass
class CostModel:
    """Indian market transaction cost model (per completed order leg)."""

    brokerage_flat: float = config.BROKERAGE_PER_ORDER_FLAT
    # Percentage charges applied on turnover (buy+sell notional).
    stt_buy: float = config.STT_EQUITY_INTRADAY_BUY
    stt_sell: float = config.STT_EQUITY_INTRADAY_SELL
    exchange_txn: float = config.EXCHANGE_TXN_CHARGE
    sebi_turnover: float = config.SEBI_TURNOVER_FEE
    stamp_duty_buy: float = config.STAMP_DUTY_BUY
    gst: float = config.GST_ON_BROKERAGE
    slippage_bps: float = 5.0  # 0.05 % per fill

    def buy_cost(self, notional: float) -> float:
        pct = self.stt_buy + self.exchange_txn + self.sebi_turnover + self.stamp_duty_buy
        slip = notional * self.slippage_bps / 10_000
        return self.brokerage_flat + notional * pct + slip + self.gst * self.brokerage_flat

    def sell_cost(self, notional: float) -> float:
        pct = self.stt_sell + self.exchange_txn + self.sebi_turnover
        slip = notional * self.slippage_bps / 10_000
        return self.brokerage_flat + notional * pct + slip + self.gst * self.brokerage_flat


@dataclass
class BacktestConfig:
    initial_capital: float = 100_000.0
    cost_model: CostModel = field(default_factory=CostModel)
    allow_short: bool = False
    risk_free_rate: float = 0.06  # annual, for Sharpe/Sortino


@dataclass
class Trade:
    entry_time: pd.Timestamp
    exit_time: pd.Timestamp | None
    side: str  # "LONG" | "SHORT"
    qty: float
    entry_price: float
    exit_price: float | None
    pnl: float  # net of costs
    return_pct: float
    costs: float


@dataclass
class BacktestResult:
    equity: pd.Series
    returns: pd.Series
    trades: list[Trade]
    metrics: dict
    config_snapshot: dict

    def summary(self) -> dict:
        return {"metrics": self.metrics, "n_trades": len(self.trades)}


def _leg_cost(cm: CostModel, side: str, qty: float, price: float) -> float:
    """Cost for one order leg (side = BUY/SELL)."""
    notional = qty * price
    if side == "BUY":
        return cm.buy_cost(notional)
    return cm.sell_cost(notional)


def run_backtest(
    data: pd.DataFrame,
    signal: pd.Series,
    cfg: BacktestConfig | None = None,
) -> BacktestResult:
    """Run backtest over OHLCV *data* with target-position *signal*.

    Parameters
    ----------
    data   : DataFrame indexed by date with Open/High/Low/Close/Volume
    signal : Series aligned to data index; values in {1, 0, -1}
             (signal computed on bar i-1 close is acted on bar i open)
    """
    cfg = cfg or BacktestConfig()
    cm = cfg.cost_model

    if not data.index.is_monotonic_increasing:
        data = data.sort_index()
    signal = signal.reindex(data.index).fillna(0).astype(int)
    if not cfg.allow_short:
        signal = signal.clip(lower=0)

    o = data["Open"].to_numpy(dtype=float)
    c = data["Close"].to_numpy(dtype=float)
    sig = signal.to_numpy()
    n = len(data)

    cash = cfg.initial_capital
    qty = 0.0
    entry_price = 0.0
    entry_time: pd.Timestamp | None = None
    entry_side = ""
    entry_cost = 0.0
    equity = np.empty(n, dtype=float)
    trades: list[Trade] = []
    total_costs = 0.0

    for i in range(n):
        target = int(sig[i])
        holding = 1 if qty > 0 else (-1 if qty < 0 else 0)

        if target != holding:
            # --- exit existing position at this bar's open ---
            if holding != 0:
                fill = o[i]
                order_side = "SELL" if holding == 1 else "BUY"
                cost = _leg_cost(cm, order_side, abs(qty), fill)
                gross = (fill - entry_price) * qty  # qty>0 long, qty<0 short
                pnl = gross - cost - entry_cost
                cash += qty * fill - cost  # full proceeds (long) / cover payment (short)
                total_costs += cost  # entry_cost already counted at entry
                trades.append(
                    Trade(
                        entry_time=entry_time,
                        exit_time=data.index[i],
                        side=entry_side,
                        qty=abs(qty),
                        entry_price=entry_price,
                        exit_price=fill,
                        pnl=pnl,
                        return_pct=pnl / (abs(qty) * entry_price),
                        costs=cost + entry_cost,
                    )
                )
                qty = 0.0
                entry_cost = 0.0

            # --- enter new position at this bar's open ---
            if target != 0 and cash > 0:
                fill = o[i]
                new_qty = np.floor(cash / fill) if fill > 0 else 0.0
                if new_qty > 0:
                    order_side = "BUY" if target == 1 else "SELL"
                    cost = _leg_cost(cm, order_side, new_qty, fill)
                    if target == 1:
                        qty = new_qty
                        cash -= new_qty * fill + cost
                    else:  # short: proceeds credited, cost debited
                        qty = -new_qty
                        cash += new_qty * fill - cost
                    entry_cost = cost
                    total_costs += cost
                    entry_price = fill
                    entry_time = data.index[i]
                    entry_side = "LONG" if target == 1 else "SHORT"

        # Mark-to-market equity at close.
        equity[i] = cash + qty * c[i]

    # Force-close open position at last close for honest accounting.
    if qty != 0:
        fill = c[-1]
        order_side = "SELL" if qty > 0 else "BUY"
        cost = _leg_cost(cm, order_side, abs(qty), fill)
        gross = (fill - entry_price) * qty
        pnl = gross - cost - entry_cost
        cash += qty * fill - cost  # full proceeds (long) / cover payment (short)
        total_costs += cost  # entry_cost already counted at entry
        equity[-1] = cash
        trades.append(
            Trade(
                entry_time=entry_time,
                exit_time=data.index[-1],
                side=entry_side,
                qty=abs(qty),
                entry_price=entry_price,
                exit_price=fill,
                pnl=pnl,
                return_pct=pnl / (abs(qty) * entry_price),
                costs=cost + entry_cost,
            )
        )

    equity_s = pd.Series(equity, index=data.index, name="equity")
    returns = equity_s.pct_change().fillna(0.0)

    from app.backtest.metrics import compute_metrics

    metrics = compute_metrics(
        equity=equity_s,
        returns=returns,
        trades=trades,
        initial_capital=cfg.initial_capital,
        risk_free_rate=cfg.risk_free_rate,
        total_costs=total_costs,
    )
    return BacktestResult(
        equity=equity_s,
        returns=returns,
        trades=trades,
        metrics=metrics,
        config_snapshot={
            "initial_capital": cfg.initial_capital,
            "allow_short": cfg.allow_short,
            "slippage_bps": cm.slippage_bps,
            "brokerage_flat": cm.brokerage_flat,
        },
    )
