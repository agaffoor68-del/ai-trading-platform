"""Paper trading state + fill logic (JSON-file persisted, SQLite later)."""
from __future__ import annotations

import json
import logging
import time
import uuid

from app.config import BACKEND_DIR

logger = logging.getLogger(__name__)

STATE_FILE = BACKEND_DIR / "paper_state.json"
START_CAPITAL = 100_000.0
MAX_QTY = 1000
DAILY_LOSS_CAP = -10_000.0


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"orders": [], "positions": {}, "trades": [], "kill": False}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=1))


def day_pnl(state: dict) -> float:
    today = time.strftime("%Y-%m-%d")
    return sum(t.get("pnl", 0) for t in state["trades"] if t.get("date") == today)


def apply_fill(state: dict, sym: str, side: str, qty: int, price: float,
               order_type: str, product: str) -> dict:
    """Apply a paper fill: update position, append order + trade records."""
    pos = state["positions"].get(sym, {"qty": 0, "avg": 0.0})
    oid = f"P-{uuid.uuid4().hex[:8].upper()}"
    pnl = 0.0
    if side == "BUY":
        new_qty = pos["qty"] + qty
        pos["avg"] = (pos["avg"] * pos["qty"] + price * qty) / new_qty if new_qty else 0
        pos["qty"] = new_qty
    else:
        closed = min(qty, pos["qty"]) if pos["qty"] > 0 else 0
        pnl = (price - pos["avg"]) * closed if closed else 0.0
        pos["qty"] -= closed
        if pos["qty"] == 0:
            pos["avg"] = 0.0
        short = qty - closed
        if short:
            if pos["qty"] < 0:
                pos["avg"] = (abs(pos["avg"]) * abs(pos["qty"]) + price * short) / (abs(pos["qty"]) + short)
            elif pos["qty"] == 0:
                pos["avg"] = price
            pos["qty"] -= short
    state["positions"][sym] = pos
    state["orders"].append({
        "order_id": oid, "symbol": sym, "side": side, "qty": qty,
        "price": round(price, 2), "order_type": order_type,
        "product": product, "status": "FILLED", "mode": "paper",
        "ts": time.strftime("%Y-%m-%d %H:%M:%S"),
    })
    state["trades"].append({
        "id": oid, "date": time.strftime("%Y-%m-%d"), "time": time.strftime("%H:%M:%S"),
        "symbol": sym, "side": side, "qty": qty,
        "entry": round(price, 2), "exit": round(price, 2),
        "pnl": round(pnl, 2), "mode": "paper", "strategy": "manual",
    })
    logger.info("paper fill %s %s %d @ %s", oid, sym, qty, price)
    return {"order_id": oid, "status": "FILLED", "price": round(price, 2)}
