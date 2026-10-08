"""Real-time tick broadcaster — polls quotes, pushes JSON over WebSocket."""
from __future__ import annotations

import asyncio
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ws"])

WATCH = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN",
         "ITC", "LT", "TATAMOTORS", "BAJFINANCE", "^NSEI", "^NSEBANK"]


@router.websocket("/ws/live")
async def live_ticks(ws: WebSocket):
    await ws.accept()
    from app.market import _quote_for  # lazy: keeps startup light
    try:
        while True:
            for sym in WATCH:
                try:
                    q = await asyncio.to_thread(_quote_for, sym)
                    await ws.send_json({**q, "ts": int(time.time() * 1000)})
                except Exception as exc:
                    logger.debug("tick skip %s: %s", sym, exc)
                await asyncio.sleep(0.4)
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("ws closed: %s", exc)
