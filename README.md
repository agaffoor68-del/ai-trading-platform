# AlphaTradePro 🇮🇳

Institute-level AI-powered trading platform for the Indian market (NSE/BSE) — Yahoo Finance data, AI backtesting, best-indicator optimization, stocks + options analysis, multi-broker execution (Zerodha, Angel One, Dhan, **Kotak Neo**), and a 24/7 self-learning loop.

> ⚠️ **Safety:** `TRADING_MODE=paper` by default. Live orders are only possible in Phase 3 with broker credentials + explicit `TRADING_MODE=live`. Backtested performance never guarantees future results.

## Quick Start

```bash
pip install -r requirements.txt
cd backend
uvicorn app.main:app --reload        # API: http://127.0.0.1:8000  (docs: /docs)
python -m pytest -q                   # run test suite (39 tests)
python e2e_smoke.py                   # live Yahoo data -> backtest -> optimizer
```

## Architecture

```
backend/app/
├── config.py          # paths, cost model constants, SEBI rate limits, TRADING_MODE
├── main.py            # FastAPI entrypoint
├── api/               # routes (data, backtest, optimize) + pydantic schemas
├── data/yahoo.py      # DataEngine: yfinance download + incremental CSV cache
├── indicators/        # RSI, EMA/SMA, MACD, Bollinger, ATR, ADX, Supertrend, Stochastic, VWAP
└── backtest/
    ├── engine.py      # next-open execution (no look-ahead), India cost model
    ├── metrics.py     # Sharpe, Sortino, MaxDD, win-rate, profit factor, expectancy
    ├── strategies.py  # strategy registry (@register) — 5 built-ins
    └── optimize.py    # Optuna + walk-forward validation (OOS reporting)
```

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | status, version, trading mode |
| GET | `/api/strategies` | registered strategies |
| POST | `/api/data/candles` | Yahoo OHLCV (NSE `.NS` auto-suffix, cached) |
| POST | `/api/backtest` | run backtest → metrics + trades + equity curve |
| POST | `/api/optimize` | Optuna walk-forward "best indicator settings" |

### Example

```bash
curl -X POST http://127.0.0.1:8000/api/backtest -H "Content-Type: application/json" -d '{
  "symbol": "RELIANCE", "strategy": "ema_crossover",
  "params": {"fast": 20, "slow": 50},
  "period": "2y", "initial_capital": 100000
}'
```

## Design decisions

- **Custom engine (no vectorbt/pandas-ta):** Python 3.12 + modern pandas pe wo libraries fragile hoti hain; custom engine se India-specific costs (brokerage ₹20/order, STT, exchange txn, GST, stamp duty, slippage bps) exact model ho paye.
- **Next-open execution:** signal bar N ke close pe, fill bar N+1 open pe — look-ahead bias nahi.
- **Walk-forward optimization:** train folds pe Optuna, best params ka out-of-sample evaluation held-out test folds pe — curve-fitting se bachne ke liye (OOS metrics hamesha report hote hain, chahe wo negative aayein).
- **Paper-first:** risk gates + SEBI 30 orders/sec cap Phase 3 se pehle enforce honge.

## Roadmap

- [x] **Phase 1:** DataEngine (Yahoo), indicator library, backtest + metrics, walk-forward optimizer, REST API
- [x] **AlphaTradePro core:** risk manager (pre-trade gates, position sizing, SEBI throttle), order router (paper fill / broker forward), broker adapters — Kite, Angel SmartAPI, Dhan, **Kotak Neo** (credential-gated), options analytics (Black-Scholes Greeks, IV, chain + PCR), trade journal + attribution UI
- [ ] **Phase 2:** ML signals (XGBoost/LSTM), live OI feed, LLM analyst
- [ ] **Phase 3:** real broker order placement (certified keys) + paper→live switch hardening
- [ ] **Phase 4:** self-learning loop, Telegram alerts
