"""AlphaTradePro risk manager — pre-trade gates for paper AND live.

All checks are pure functions so they can be unit-tested offline and reused
by the order router before any broker call.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from app import config


@dataclass
class RiskLimits:
    max_daily_loss: float = -10_000.0      # ₹ — block new orders below this day-PnL
    max_position_pct: float = 0.05         # 5% of capital per symbol
    max_portfolio_heat_pct: float = 0.25   # 25% total exposure cap
    max_order_qty: int = 1000
    max_orders_per_sec: int = 30           # SEBI retail algo cap
    kill_switch: bool = False


@dataclass
class RiskCheck:
    allowed: bool
    reason: str = ""
    position_value: float = 0.0
    exposure_pct: float = 0.0


@dataclass
class RateLimiter:
    """Sliding-window order throttle (SEBI 30 orders/sec/client)."""

    max_per_sec: int = config.SEBI_ORDER_RATE_LIMIT
    _stamps: list = field(default_factory=list)

    def allow(self, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        cutoff = now - 1.0
        self._stamps = [t for t in self._stamps if t > cutoff]
        if len(self._stamps) >= self.max_per_sec:
            return False
        self._stamps.append(now)
        return True


_limiter = RateLimiter()


def reset_rate_limiter() -> None:
    _limiter._stamps.clear()


def position_size_for_risk(capital: float, entry: float, stop: float,
                            risk_pct: float = 0.01) -> int:
    """Fixed-fractional size: risk `risk_pct` of capital per trade."""
    if entry <= 0 or stop <= 0 or entry == stop or capital <= 0:
        return 0
    risk_amount = capital * risk_pct
    per_share = abs(entry - stop)
    return max(0, int(risk_amount // per_share))


def check_order(symbol: str, side: str, qty: int, price: float,
                *, capital: float, day_pnl: float,
                positions: dict, limits: RiskLimits | None = None) -> RiskCheck:
    """Run every pre-trade gate. Returns allowed + human-readable reason."""
    limits = limits or RiskLimits()
    if limits.kill_switch:
        return RiskCheck(False, "Kill-switch ON — trading halted.")
    if side not in ("BUY", "SELL"):
        return RiskCheck(False, "side must be BUY|SELL")
    if qty <= 0 or qty > limits.max_order_qty:
        return RiskCheck(False, f"qty must be 1..{limits.max_order_qty}")
    if price <= 0:
        return RiskCheck(False, "price must be positive")
    if day_pnl <= limits.max_daily_loss:
        return RiskCheck(False, f"Daily loss cap hit ({day_pnl:.0f} <= {limits.max_daily_loss:.0f}).")
    if not _limiter.allow():
        return RiskCheck(False, f"Order rate limit ({limits.max_orders_per_sec}/sec) hit — slow down.")
    notional = qty * price
    exposure_pct = notional / capital if capital > 0 else 1.0
    if exposure_pct > limits.max_position_pct:
        return RiskCheck(
            False,
            f"Position size {exposure_pct*100:.1f}% exceeds cap {limits.max_position_pct*100:.0f}% "
            f"(qty {qty} @ {price:.2f} on capital {capital:.0f}).",
            position_value=notional, exposure_pct=exposure_pct,
        )
    # Portfolio heat: sum of open notionals + this order
    open_notional = sum(abs(p.get('qty', 0)) * p.get('avg', price)
                        for p in positions.values())
    heat = (open_notional + notional) / capital if capital > 0 else 1.0
    if heat > limits.max_portfolio_heat_pct + limits.max_position_pct:
        return RiskCheck(False, f"Portfolio heat {heat*100:.1f}% exceeds cap.", notional, heat)
    return RiskCheck(True, "ok", notional, exposure_pct)
