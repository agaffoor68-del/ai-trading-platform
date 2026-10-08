"""AlphaTradePro options analytics — Black-Scholes Greeks + IV + OI helpers.

Pure-python (stdlib only) so backtests and the API can use it with no extra deps.
"""
from __future__ import annotations

import math

SQRT_2PI = math.sqrt(2 * math.pi)


def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / SQRT_2PI


def bs_price(spot: float, strike: float, t_years: float, rate: float,
             vol: float, kind: str = "CE") -> float:
    """Black-Scholes option price. kind = CE (call) | PE (put)."""
    if spot <= 0 or strike <= 0 or t_years <= 0 or vol <= 0:
        intrinsic = max(spot - strike, 0.0) if kind == "CE" else max(strike - spot, 0.0)
        return round(intrinsic, 2)
    d1 = (math.log(spot / strike) + (rate + 0.5 * vol * vol) * t_years) / (vol * math.sqrt(t_years))
    d2 = d1 - vol * math.sqrt(t_years)
    disc = math.exp(-rate * t_years)
    if kind == "CE":
        px = spot * _norm_cdf(d1) - strike * disc * _norm_cdf(d2)
    else:
        px = strike * disc * _norm_cdf(-d2) - spot * _norm_cdf(-d1)
    return round(max(px, 0.0), 2)


def greeks(spot: float, strike: float, t_years: float, rate: float,
           vol: float, kind: str = "CE") -> dict:
    """Delta, gamma, theta (/day), vega (/1% vol), rho for one contract."""
    t = max(t_years, 1e-6)
    vol = max(vol, 1e-4)
    d1 = (math.log(spot / strike) + (rate + 0.5 * vol * vol) * t) / (vol * math.sqrt(t))
    d2 = d1 - vol * math.sqrt(t)
    pdf = _norm_pdf(d1)
    disc = math.exp(-rate * t)
    if kind == "CE":
        delta = _norm_cdf(d1)
        theta = (-(spot * pdf * vol) / (2 * math.sqrt(t))
                 - rate * strike * disc * _norm_cdf(d2)) / 365.0
        rho = strike * t * disc * _norm_cdf(d2) / 100.0
    else:
        delta = _norm_cdf(d1) - 1.0
        theta = (-(spot * pdf * vol) / (2 * math.sqrt(t))
                 + rate * strike * disc * _norm_cdf(-d2)) / 365.0
        rho = -strike * t * disc * _norm_cdf(-d2) / 100.0
    gamma = pdf / (spot * vol * math.sqrt(t))
    vega = spot * pdf * math.sqrt(t) / 100.0
    return {"delta": round(delta, 4), "gamma": round(gamma, 6),
            "theta": round(theta, 4), "vega": round(vega, 4), "rho": round(rho, 4)}


def implied_vol(price: float, spot: float, strike: float, t_years: float,
                rate: float, kind: str = "CE") -> float:
    """Bisection IV solver. Returns vol as decimal (0.25 = 25%)."""
    lo, hi = 0.01, 5.0
    for _ in range(60):
        mid = (lo + hi) / 2
        px = bs_price(spot, strike, t_years, rate, mid, kind)
        if abs(px - price) < 0.01:
            return round(mid, 4)
        if px < price:
            lo = mid
        else:
            hi = mid
    return round((lo + hi) / 2, 4)


def option_chain(spot: float, expiry_days: int = 7, n_strikes: int = 7,
                 step_pct: float = 0.01, vol: float = 0.25,
                 rate: float = 0.065) -> dict:
    """Synthetic NIFTY-style chain around spot (real OI needs broker feed)."""
    t = max(expiry_days, 1) / 365.0
    step = max(round(spot * step_pct / 50.0) * 50.0, 50.0)
    atm = round(spot / step) * step
    rows = []
    for i in range(-n_strikes, n_strikes + 1):
        k = atm + i * step
        ce, pe = bs_price(spot, k, t, rate, vol, "CE"), bs_price(spot, k, t, rate, vol, "PE")
        rows.append({"strike": k, "ce": ce, "pe": pe,
                     **{f"ce_{g}": v for g, v in greeks(spot, k, t, rate, vol, "CE").items()},
                     **{f"pe_{g}": v for g, v in greeks(spot, k, t, rate, vol, "PE").items()},
                     "oi_ce": max(0, int(50000 - abs(i) * 6000)),
                     "oi_pe": max(0, int(50000 - abs(i) * 6000)),
                     "itm_ce": spot > k, "itm_pe": spot < k})
    ce_oi = sum(r["oi_ce"] for r in rows)
    pe_oi = sum(r["oi_pe"] for r in rows)
    return {"spot": round(spot, 2), "expiry_days": expiry_days, "iv": vol,
            "pcr": round(pe_oi / ce_oi, 2) if ce_oi else 0.0,
            "max_pain": atm, "rows": rows}
