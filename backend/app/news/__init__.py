"""News + sentiment feed (free RSS sources, heuristic sentiment scoring)."""
from __future__ import annotations

import logging
import re
import time
import urllib.request
import xml.etree.ElementTree as ET

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/news", tags=["news"])

FEEDS = {
    "market": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    "stocks": "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms",
}

BULL_WORDS = {"rally", "surge", "gain", "record", "bull", "upgrade", "profit", "growth",
              "outperform", "buy", "breakout", "high", "rise", "jumps", "soars"}
BEAR_WORDS = {"fall", "drop", "crash", "bear", "downgrade", "loss", "sell", "slump",
              "low", "decline", "plunge", "tumble", "fear", "warning", "fraud"}

_CACHE: dict[str, tuple[float, list]] = {}
_TTL = 600.0


def _sentiment(text: str) -> float:
    words = set(re.findall(r"[a-z]+", text.lower()))
    bull = len(words & BULL_WORDS)
    bear = len(words & BEAR_WORDS)
    if not bull and not bear:
        return 0.0
    return round((bull - bear) / max(bull + bear, 1), 2)


def _fetch(feed_url: str) -> list[dict]:
    req = urllib.request.Request(feed_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as fh:
        root = ET.fromstring(fh.read())
    items = []
    for item in root.iter("item")[:20]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        desc = (item.findtext("description") or "").strip()[:200]
        if title:
            items.append({"title": title, "link": link, "published": pub,
                          "snippet": desc, "sentiment": _sentiment(title + " " + desc)})
    return items


@router.get("")
def news(feed: str = "market"):
    now = time.time()
    if feed in _CACHE and now - _CACHE[feed][0] < _TTL:
        items = _CACHE[feed][1]
    else:
        try:
            items = _fetch(FEEDS.get(feed, FEEDS["market"]))
        except Exception as exc:
            logger.warning("news fetch failed: %s", exc)
            items = []
        _CACHE[feed] = (now, items)
    avg = round(sum(i["sentiment"] for i in items) / len(items), 2) if items else 0.0
    return {"feed": feed, "items": items, "avg_sentiment": avg,
            "mood": "Bullish" if avg > 0.1 else ("Bearish" if avg < -0.1 else "Neutral")}
