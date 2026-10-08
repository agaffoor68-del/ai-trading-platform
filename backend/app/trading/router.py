"""AlphaTradePro order router — risk gates first, then paper fill or broker submit."""
from __future__ import annotations

import logging
import time

from app import config
from app.brokers import get_broker
from app.risk import RiskLimits, check_order
from app.trading.engine import apply_fill, day_pnl, load_state, save_state

logger = logging.getLogger(__name__)


def route_order(symbol: str, side: str, qty: int, price: float,
                *, mode: str = "paper", broker: str = "zerodha",
                order_type: str = "MARKET", product: str = "MIS",
                capital: float = 100_000.0) -> dict:
    """Validate via risk manager, then fill paper or forward to a broker."""
    state = load_state()
    limits = RiskLimits(kill_switch=bool(state.get("kill")))
    chk = check_order(symbol, side, qty, price, capital=capital,
                      day_pnl=day_pnl(state), positions=state["positions"],
                      limits=limits)
    if not chk.allowed:
        return {"ok": False, "status": "REJECTED", "reason": chk.reason}

    if mode == "live":
        if config.TRADING_MODE != "live":
            return {"ok": False, "status": "REJECTED",
                    "reason": "Live trading disabled (Phase 3). TRADING_MODE=live + broker credentials needed."}
        try:
            fill = get_broker(broker).place_order(symbol, side, qty, order_type)
        except Exception as exc:
            logger.warning("live order failed: %s", exc)
            return {"ok": False, "status": "REJECTED", "reason": str(exc)}
        state["orders"].append({"order_id": fill["order_id"], "symbol": symbol,
                                "side": side, "qty": qty, "status": fill["status"],
                                "mode": "live", "broker": broker,
                                "ts": time.strftime("%Y-%m-%d %H:%M:%S")})
        save_state(state)
        return {"ok": True, **fill}

    fill = apply_fill(state, symbol, side, qty, price, order_type, product)
    save_state(state)
    return {"ok": True, **fill}
