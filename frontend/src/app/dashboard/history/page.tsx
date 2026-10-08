"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { History as HistoryIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Skeleton } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { apiGet } from "@/lib/api";
import { cn, pctClass } from "@/lib/utils";

/* Trade history — filters, summary cards, row click → chart with markers. */

interface Trade {
  id: string;
  date: string;
  time: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  mode: string;
  strategy: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [winLoss, setWinLoss] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["trade-history"],
    queryFn: () => apiGet<{ trades: Trade[]; total: number }>("/api/trades/history?limit=200"),
    refetchInterval: 15000,
  });

  const trades = useMemo(() => {
    let list = data?.trades ?? [];
    if (filter) {
      const f = filter.toUpperCase();
      list = list.filter((t) => t.symbol.includes(f) || t.strategy.toUpperCase().includes(f));
    }
    if (winLoss === "win") list = list.filter((t) => t.pnl > 0);
    if (winLoss === "loss") list = list.filter((t) => t.pnl <= 0);
    return list;
  }, [data, filter, winLoss]);

  const wins = trades.filter((t) => t.pnl > 0).length;
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <HistoryIcon className="h-5 w-5 text-primary" /> Trade History
      </h1>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total Trades", value: String(trades.length) },
          { label: "Win Rate", value: `${winRate.toFixed(1)}%` },
          { label: "Net P&L", value: `${totalPnl >= 0 ? "+" : "-"}₹${Math.abs(totalPnl).toFixed(0)}` },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-text-muted">{c.label}</p>
              <p className={cn("mt-1 font-mono text-xl font-bold tabular", c.label === "Net P&L" && pctClass(totalPnl))}>
                {c.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Input
            placeholder="Filter: symbol ya strategy…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-64 font-mono uppercase"
            aria-label="Filter trades"
          />
          <Select value={winLoss} onChange={(e) => setWinLoss(e.target.value)} aria-label="Win loss filter">
            <option value="all">All</option>
            <option value="win">Winners</option>
            <option value="loss">Losers</option>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Trades ({trades.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !trades.length ? (
            <p className="py-8 text-center text-sm text-text-muted">
              Koi trade nahi — Paper terminal se pehla trade karein.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Symbol</th>
                    <th className="py-2 pr-3">Side</th>
                    <th className="py-2 pr-3 text-right">Qty</th>
                    <th className="py-2 pr-3 text-right">Entry</th>
                    <th className="py-2 pr-3 text-right">Exit</th>
                    <th className="py-2 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular">
                  {trades.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/dashboard/chart?symbol=${t.symbol}`)}
                      title="Chart pe entry/exit markers dekhein"
                      className="cursor-pointer border-b border-border/50 transition hover:bg-primary/5"
                    >
                      <td className="py-2 pr-3">{t.date}</td>
                      <td className="py-2 pr-3 text-text-muted">{t.time}</td>
                      <td className="py-2 pr-3 font-semibold">{t.symbol}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={t.side === "BUY" ? "success" : "danger"}>{t.side}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-right">{t.qty}</td>
                      <td className="py-2 pr-3 text-right">{t.entry.toFixed(2)}</td>
                      <td className="py-2 pr-3 text-right">{t.exit.toFixed(2)}</td>
                      <td className={cn("py-2 text-right font-semibold", pctClass(t.pnl))}>
                        {t.pnl >= 0 ? "+" : "-"}₹{Math.abs(t.pnl).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
