"""Trading API routes — paper orders, positions, history, kill-switch."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.market import _quote_for
from app.trading.engine import START_CAPITAL, day_pnl, load_state, save_state
from app.trading.router import route_order

router = APIRouter(prefix="/api", tags=["trading"])


class PlaceOrderBody(BaseModel):
    symbol: str
    qty: int = Field(gt=0, le=1000)
    side: str
    order_type: str = "MARKET"
    product: str = "MIS"
    limit_price: float | None = None
    mode: str = "paper"
    broker: str = "zerodha"


@router.post("/order/place")
def place_order(body: PlaceOrderBody):
    if body.side not in ("BUY", "SELL"):
        raise HTTPException(status_code=400, detail="side must be BUY|SELL")
    sym = body.symbol.strip().upper()
    try:
        q = _quote_for(sym)
    except HTTPException as exc:
        raise HTTPException(status_code=502, detail=f"no quote for {sym}") from exc
    price = q["price"] if body.order_type == "MARKET" else (body.limit_price or q["price"])
    out = route_order(sym, body.side, body.qty, price, mode=body.mode,
                      broker=body.broker, order_type=body.order_type,
                      product=body.product)
    if not out.get("ok"):
        raise HTTPException(status_code=423, detail=out.get("reason", "rejected"))
    return out


@router.post("/order/cancel")
def cancel_order(order_id: str):
    state = load_state()
    for o in state["orders"]:
        if o["order_id"] == order_id:
            o["status"] = "CANCELLED"
            save_state(state)
            return {"ok": True, "order_id": order_id}
    raise HTTPException(status_code=404, detail="order not found")


@router.get("/positions")
def positions():
    state = load_state()
    out, total = [], 0.0
    for sym, p in state["positions"].items():
        if not p.get("qty"):
            continue
        try:
            ltp = _quote_for(sym)["price"]
        except HTTPException:
            ltp = p["avg"]
        pnl = (ltp - p["avg"]) * p["qty"]
        total += pnl
        out.append({"symbol": sym, "side": "LONG" if p["qty"] > 0 else "SHORT",
                    "qty": abs(p["qty"]), "entry": round(p["avg"], 2),
                    "ltp": round(ltp, 2), "pnl": round(pnl, 2), "mode": "paper"})
    return {"positions": out, "total_pnl": round(total, 2)}


@router.get("/positions/summary")
def positions_summary():
    state = load_state()
    pos = positions()["positions"]
    open_pnl = sum(p["pnl"] for p in pos)
    wins = sum(1 for t in state["trades"] if t.get("pnl", 0) > 0)
    n = len(state["trades"])
    run, series = START_CAPITAL, [START_CAPITAL]
    for t in state["trades"][-30:]:
        run += t.get("pnl", 0)
        series.append(round(run, 2))
    return {
        "portfolio_value": round(run + open_pnl, 2),
        "today_pnl": round(day_pnl(state) + open_pnl, 2),
        "today_pnl_pct": round(open_pnl / START_CAPITAL * 100, 3),
        "win_rate": round(wins / n * 100, 1) if n else 0.0,
        "active_positions": len(pos),
        "portfolio_series": series,
    }


@router.get("/orders")
def orders(mode: str | None = None):
    all_orders = list(reversed(load_state()["orders"]))
    if mode:
        all_orders = [o for o in all_orders if str(o.get("mode", "paper")).lower() == mode.lower()]
    return {"orders": all_orders[:100]}


@router.get("/trades/history")
def trades_history(symbol: str | None = None, as_markers: bool = False, limit: int = 200):
    trades = load_state()["trades"]
    if symbol:
        trades = [t for t in trades if t["symbol"] == symbol.strip().upper()]
    trades = trades[-limit:]
    if as_markers:
        import datetime as _dt
        markers = []
        for t in trades:
            try:
                ts = int(_dt.datetime.strptime(
                    f"{t['date']} {t.get('time', '09:15:00')}",
                    "%Y-%m-%d %H:%M:%S").timestamp())
            except Exception:
                continue
            markers.append({
                "id": t["id"], "time": ts,
                "type": "buy" if t["side"] == "BUY" else "sell",
                "price": t["entry"],
                "meta": {"date": t["date"], "time": t.get("time", ""),
                         "entryPrice": t["entry"], "exitPrice": t["exit"],
                         "qty": t["qty"], "pnl": t["pnl"],
                         "duration": "intraday", "strategy": t.get("strategy", "manual")},
            })
        return {"markers": markers}
    return {"trades": list(reversed(trades)), "total": len(trades)}


@router.post("/risk/kill")
def kill_switch(on: bool = True):
    state = load_state()
    state["kill"] = on
    save_state(state)
    return {"kill": on}
