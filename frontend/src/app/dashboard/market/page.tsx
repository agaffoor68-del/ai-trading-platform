"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { apiGet } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/badge";
import { cn, pctClass, formatCompact } from "@/lib/utils";

/* Market watch — multi-symbol live board (spec route /dashboard/market). */

const WATCHLIST = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN",
  "TATAMOTORS", "ADANIENT", "ITC", "LT", "BAJFINANCE", "WIPRO",
];

interface Quote {
  symbol: string;
  price: number;
  change_pct: number;
  volume: number;
}

export default function MarketPage() {
  const setSymbol = useAppStore((s) => s.setSymbol);
  const ticks = useAppStore((s) => s.ticks);

  const { data, isLoading } = useQuery({
    queryKey: ["market-watch"],
    queryFn: () =>
      apiGet<{ quotes: Quote[] }>(
        `/api/market/quotes?symbols=${WATCHLIST.join(",")}`
      ),
    refetchInterval: 10000,
  });

  // Merge WS ticks over polled quotes for flash updates.
  const quotes = (data?.quotes ?? []).map((q) => {
    const t = ticks[q.symbol];
    return t ? { ...q, price: t.price, change_pct: t.change_pct } : q;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold tracking-tight">Market Watch</h1>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {quotes.map((q) => {
            const up = q.change_pct >= 0;
            return (
              <button
                key={q.symbol}
                onClick={() => {
                  setSymbol(q.symbol);
                  window.location.href = "/dashboard/chart";
                }}
                className="glass-card p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold">{q.symbol}</span>
                  <span
                    className={cn(
                      "font-mono text-xs tabular",
                      pctClass(q.change_pct)
                    )}
                  >
                    {up ? "▲" : "▼"} {Math.abs(q.change_pct).toFixed(2)}%
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-1 font-mono text-xl font-bold tabular",
                    up ? "text-success" : "text-danger"
                  )}
                >
                  ₹{q.price.toFixed(2)}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  Vol {formatCompact(q.volume)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Sector heatmap (simplified: gainers/losers split) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Breadth — Gainers vs Losers</CardTitle>
        </CardHeader>
        <CardContent className="flex h-10 overflow-hidden rounded-lg font-mono text-xs">
          {quotes.map((q) => {
            const up = q.change_pct >= 0;
            const w = 100 / Math.max(quotes.length, 1);
            return (
              <div
                key={q.symbol}
                title={`${q.symbol}: ${q.change_pct.toFixed(2)}%`}
                style={{ width: `${w}%` }}
                className={cn(
                  "flex items-center justify-center border-r border-background/40 text-[10px] font-bold",
                  up ? "bg-success/60 text-background" : "bg-danger/60 text-white"
                )}
              >
                {q.symbol.slice(0, 4)}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
