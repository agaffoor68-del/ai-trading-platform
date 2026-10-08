"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Skeleton } from "@/components/ui/badge";
import { apiGet } from "@/lib/api";
import { cn, formatINR as inr } from "@/lib/utils";

interface ChainRow {
  strike: number;
  ce: number;
  pe: number;
  ce_delta: number;
  pe_delta: number;
  ce_theta: number;
  pe_theta: number;
  ce_iv?: number;
  pe_iv?: number;
  oi_ce: number;
  oi_pe: number;
  itm_ce: boolean;
  itm_pe: boolean;
}

/* AlphaTradePro Options desk — chain + PCR + Greeks. */
export default function OptionsPage() {
  const [symbol, setSymbol] = useState("NIFTY");
  const { data, isLoading } = useQuery({
    queryKey: ["options-chain", symbol],
    queryFn: () =>
      apiGet<{
        symbol: string;
        spot: number;
        pcr: number;
        max_pain: number;
        iv: number;
        rows: ChainRow[];
      }>(`/api/options/chain?symbol=${encodeURIComponent(symbol)}`),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight">Options Desk</h1>
        {["NIFTY", "BANKNIFTY", "RELIANCE", "TCS"].map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
              symbol === s
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border text-text-muted hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Spot", value: data ? inr(data.spot) : "—" },
          { label: "PCR (OI)", value: data?.pcr.toFixed(2) ?? "—" },
          { label: "Max Pain", value: data ? inr(data.max_pain) : "—" },
          { label: "IV", value: data ? `${(data.iv * 100).toFixed(1)}%` : "—" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="py-4">
              <p className="text-xs text-text-muted">{k.label}</p>
              <p className="font-mono text-xl font-bold tabular">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-foreground">
            Option Chain — {symbol}
          </CardTitle>
          {data && (
            <Badge variant={data.pcr > 1 ? "success" : data.pcr < 0.8 ? "danger" : "default"}>
              {data.pcr > 1 ? "BULLISH" : data.pcr < 0.8 ? "BEARISH" : "NEUTRAL"}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-64 w-full" />}
          {data && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="py-2 text-right">CE LTP</th>
                    <th className="py-2 text-right">Δ</th>
                    <th className="py-2 text-right">OI CE</th>
                    <th className="py-2 text-center font-bold text-foreground">STRIKE</th>
                    <th className="py-2 text-right">OI PE</th>
                    <th className="py-2 text-right">Δ</th>
                    <th className="py-2 text-right">PE LTP</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular">
                  {data.rows.map((r) => (
                    <tr key={r.strike} className="border-b border-border/40 hover:bg-white/[0.03]">
                      <td className={cn("py-1.5 pr-2 text-right", r.itm_ce && "text-text-muted")}>
                        {r.ce.toFixed(2)}
                      </td>
                      <td className="py-1.5 pr-2 text-right text-text-muted">{r.ce_delta.toFixed(2)}</td>
                      <td className="py-1.5 pr-2 text-right">{r.oi_ce.toLocaleString("en-IN")}</td>
                      <td className="bg-white/[0.04] py-1.5 text-center font-bold">
                        {r.strike.toLocaleString("en-IN")}
                      </td>
                      <td className="py-1.5 pl-2 text-right">{r.oi_pe.toLocaleString("en-IN")}</td>
                      <td className="py-1.5 pl-2 text-right text-text-muted">{r.pe_delta.toFixed(2)}</td>
                      <td className={cn("py-1.5 pl-2 text-right", r.itm_pe && "text-text-muted")}>
                        {r.pe.toFixed(2)}
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
