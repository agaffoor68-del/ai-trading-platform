"use client";

import { useQuery } from "@tanstack/react-query";
import { CandlestickChart, type TradeMarker } from "@/components/chart/candlestick-chart";
import { apiGet } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/* Full-screen chart page (spec route /dashboard/chart). */
export default function ChartPage() {
  const { symbol, setSymbol } = useAppStore();

  const { data: tradesData } = useQuery({
    queryKey: ["chart-trades-full", symbol],
    queryFn: () =>
      apiGet<{ markers: TradeMarker[] }>(
        `/api/trades/history?symbol=${encodeURIComponent(symbol)}&as_markers=true`
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight">Chart</h1>
        <div className="flex items-center gap-2">
          <Input
            defaultValue={symbol}
            placeholder="SYMBOL e.g. TCS"
            className="w-44 font-mono uppercase"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value.trim().toUpperCase();
                if (v) setSymbol(v);
              }
            }}
            aria-label="Symbol"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const el = document.querySelector<HTMLInputElement>(
                "input[aria-label='Symbol']"
              );
              if (el?.value) setSymbol(el.value.trim().toUpperCase());
            }}
          >
            Load
          </Button>
        </div>
      </div>

      <CandlestickChart
        symbol={symbol}
        trades={tradesData?.markers ?? []}
        height={620}
      />
    </div>
  );
}
