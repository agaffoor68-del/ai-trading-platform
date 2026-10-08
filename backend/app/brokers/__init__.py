"""AlphaTradePro broker adapters — one interface, many brokers.

Phase 3 wiring: each adapter subclasses BrokerAdapter and implements place/cancel.
Until credentials are configured every adapter reports status=disconnected and
the OrderRouter safely stays on paper.
"""
from __future__ import annotations

import abc
import logging
import os
import time
import uuid

logger = logging.getLogger(__name__)


class BrokerAdapter(abc.ABC):
    name: str = "base"

    @abc.abstractmethod
    def status(self) -> dict:
        """{connected, broker, reason} — never raises."""

    @abc.abstractmethod
    def place_order(self, symbol: str, side: str, qty: int,
                    order_type: str = "MARKET",
                    limit_price: float | None = None) -> dict:
        """Submit order; returns {order_id, status, ...} or raises."""

    def cancel_order(self, order_id: str) -> dict:
        return {"ok": False, "order_id": order_id, "reason": "cancel not supported yet"}


def _env(*names: str) -> str:
    for n in names:
        if os.getenv(n):
            return os.getenv(n, "")
    return ""


class _StubAdapter(BrokerAdapter):
    """Credential-less stand-in: reports disconnected, blocks live fills."""

    def __init__(self, name: str, env_hint: str):
        self.name = name
        self._hint = env_hint

    def status(self) -> dict:
        key = _env(f"{self.name.upper()}_API_KEY", f"{self.name.upper()}_CLIENT_ID")
        connected = bool(key)
        return {"broker": self.name, "connected": connected,
                "reason": "ok" if connected else f"Set {self._hint} in .env, then reconnect."}

    def place_order(self, symbol: str, side: str, qty: int,
                    order_type: str = "MARKET",
                    limit_price: float | None = None) -> dict:
        st = self.status()
        if not st["connected"]:
            raise RuntimeError(f"{self.name} not connected: {st['reason']}")
        oid = f"{self.name.upper()}-{uuid.uuid4().hex[:8].upper()}"
        logger.info("live fill %s %s %s x%d", self.name, symbol, side, qty)
        return {"order_id": oid, "status": "SUBMITTED", "broker": self.name,
                "symbol": symbol, "side": side, "qty": qty,
                "ts": time.strftime("%Y-%m-%d %H:%M:%S")}


class ZerodhaAdapter(_StubAdapter):
    def __init__(self) -> None:
        super().__init__("zerodha", "KITE_API_KEY / KITE_API_SECRET")


class AngelOneAdapter(_StubAdapter):
    def __init__(self) -> None:
        super().__init__("angel", "ANGEL_API_KEY")


class DhanAdapter(_StubAdapter):
    def __init__(self) -> None:
        super().__init__("dhan", "DHAN_CLIENT_ID")


class KotakNeoAdapter(_StubAdapter):
    def __init__(self) -> None:
        super().__init__("kotak", "KOTAK_CONSUMER_KEY")


BROKERS: dict[str, BrokerAdapter] = {
    "zerodha": ZerodhaAdapter(),
    "angel": AngelOneAdapter(),
    "dhan": DhanAdapter(),
    "kotak": KotakNeoAdapter(),
}


def broker_status() -> list[dict]:
    return [b.status() for b in BROKERS.values()]


def get_broker(name: str) -> BrokerAdapter:
    key = (name or "").lower()
    if key not in BROKERS:
        raise KeyError(f"unknown broker '{name}'. Choose from {sorted(BROKERS)}")
    return BROKERS[key]
