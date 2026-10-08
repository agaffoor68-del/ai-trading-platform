"use client";

import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Skeleton } from "@/components/ui/badge";
import { apiGet } from "@/lib/api";
import { cn, pctClass } from "@/lib/utils";

/* Open positions + P&L (spec route /dashboard/positions). */

interface Position {
  symbol: string;
  side: "LONG" | "SHORT";
  qty: number;
  entry: number;
  ltp: number;
  pnl: number;
  mode: "paper" | "live";
}

export default function PositionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: () => apiGet<{ positions: Position[]; total_pnl: number }>(
      "/api/positions"
    ),
    refetchInterval: 8000,
  });

  const totalPnl = data?.total_pnl ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Wallet className="h-5 w-5 text-primary" /> Positions
        </h1>
        <div
          className={cn(
            "rounded-lg border px-4 py-2 font-mono text-lg font-bold tabular",
            totalPnl >= 0
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
        >
          Total: {totalPnl >= 0 ? "+" : "-"}₹{Math.abs(totalPnl).toFixed(0)}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">All Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !data?.positions.length ? (
            <p className="py-8 text-center text-sm text-text-muted">
              No open positions — Paper terminal se trade karein.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="py-2 pr-4">Symbol</th>
                    <th className="py-2 pr-4">Side</th>
                    <th className="py-2 pr-4 text-right">Qty</th>
                    <th className="py-2 pr-4 text-right">Entry</th>
                    <th className="py-2 pr-4 text-right">LTP</th>
                    <th className="py-2 pr-4 text-right">Chg %</th>
                    <th className="py-2 pr-4 text-right">P&L</th>
                    <th className="py-2 text-right">Mode</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular">
                  {data.positions.map((p) => {
                    const chg = ((p.ltp - p.entry) / p.entry) * 100 * (p.side === "LONG" ? 1 : -1);
                    return (
                      <tr key={p.symbol} className="border-b border-border/40 transition hover:bg-white/[0.03]">
                        <td className="py-2.5 pr-4 font-semibold">{p.symbol}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={p.side === "LONG" ? "success" : "danger"}>{p.side}</Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-right">{p.qty}</td>
                        <td className="py-2.5 pr-4 text-right">{p.entry.toFixed(2)}</td>
                        <td className="py-2.5 pr-4 text-right">{p.ltp.toFixed(2)}</td>
                        <td className={cn("py-2.5 pr-4 text-right", pctClass(chg))}>
                          {chg.toFixed(2)}%
                        </td>
                        <td className={cn("py-2.5 pr-4 text-right font-bold", pctClass(p.pnl))}>
                          {p.pnl >= 0 ? "+" : "-"}₹{Math.abs(p.pnl).toFixed(0)}
                        </td>
                        <td className="py-2.5 text-right">
                          <Badge variant={p.mode === "live" ? "danger" : "default"}>
                            {p.mode.toUpperCase()}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
