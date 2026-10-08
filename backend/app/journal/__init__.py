"""AlphaTradePro trade journal + attribution (JSON persisted, Postgres later)."""
from __future__ import annotations

import json
import time
import uuid

from app.config import BACKEND_DIR

JOURNAL_FILE = BACKEND_DIR / "journal.json"


def load_journal() -> list[dict]:
    if JOURNAL_FILE.exists():
        try:
            data = json.loads(JOURNAL_FILE.read_text())
            return data if isinstance(data, list) else []
        except Exception:
            pass
    return []


def save_journal(entries: list[dict]) -> None:
    JOURNAL_FILE.write_text(json.dumps(entries, indent=1))


def add_entry(symbol: str, side: str, qty: int, entry: float, exit: float,
              pnl: float, strategy: str = "manual", notes: str = "",
              tags: list[str] | None = None, rating: int = 0) -> dict:
    entries = load_journal()
    item = {"id": uuid.uuid4().hex[:8], "date": time.strftime("%Y-%m-%d"),
            "symbol": symbol.upper(), "side": side, "qty": qty,
            "entry": entry, "exit": exit, "pnl": round(pnl, 2),
            "strategy": strategy, "notes": notes, "tags": tags or [],
            "rating": rating}
    entries.append(item)
    save_journal(entries)
    return item


def attribution() -> dict:
    """Win-rate / PnL grouped by strategy + symbol."""
    entries = load_journal()
    by_strategy: dict[str, dict] = {}
    by_symbol: dict[str, dict] = {}
    for e in entries:
        for key, bucket in (("strategy", by_strategy), ("symbol", by_symbol)):
            name = e.get(key, "?")
            b = bucket.setdefault(name, {"trades": 0, "wins": 0, "pnl": 0.0})
            b["trades"] += 1
            b["wins"] += 1 if e.get("pnl", 0) > 0 else 0
            b["pnl"] = round(b["pnl"] + e.get("pnl", 0), 2)
    for bucket in (by_strategy, by_symbol):
        for b in bucket.values():
            b["win_rate"] = round(b["wins"] / b["trades"] * 100, 1) if b["trades"] else 0.0
    total = round(sum(e.get("pnl", 0) for e in entries), 2)
    return {"total_trades": len(entries), "total_pnl": total,
            "by_strategy": by_strategy, "by_symbol": by_symbol}
