"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Play, Download } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/badge";
import { apiGet, apiPost } from "@/lib/api";
import { cn, pctClass } from "@/lib/utils";

/* Backtest engine + results (spec route /dashboard/backtest). */

interface BacktestResult {
  metrics: Record<string, number>;
  trades: {
    side: string;
    qty: number;
    entry_time: string;
    exit_time: string | null;
    entry_price: number;
    exit_price: number | null;
    pnl: number;
    return_pct: number;
    costs: number;
  }[];
  equity_curve: { date: string; equity: number }[];
}

const STATS: { key: string; label: string; pct?: boolean }[] = [
  { key: "total_return_pct", label: "Total Return", pct: true },
  { key: "sharpe", label: "Sharpe" },
  { key: "sortino", label: "Sortino" },
  { key: "max_drawdown_pct", label: "Max DD", pct: true },
  { key: "win_rate_pct", label: "Win Rate", pct: true },
  { key: "profit_factor", label: "Profit Factor" },
  { key: "n_trades", label: "Trades" },
  { key: "total_costs", label: "Costs (₹)" },
];

export default function BacktestPage() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [strategy, setStrategy] = useState("ema_crossover");
  const [period, setPeriod] = useState("2y");
  const [capital, setCapital] = useState(100000);
  const [fast, setFast] = useState(20);
  const [slow, setSlow] = useState(50);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const { data: strategies } = useQuery({
    queryKey: ["strategies"],
    queryFn: () =>
      apiGet<{ strategies: { id: string; name: string }[] }>("/api/strategy/list").then((d) => ({
        strategies: d.strategies.map((s) => s.id ?? s.name),
      })),
  });

  const run = async () => {
    setRunning(true);
    try {
      const params =
        strategy === "ema_crossover"
          ? { fast, slow }
          : strategy === "rsi_reversion"
            ? { period: 14, oversold: 30, overbought: 70 }
            : strategy === "supertrend_follow"
              ? { period: 10, multiplier: 3 }
              : {};
      const res = await apiPost<BacktestResult & { id: string }>("/api/backtest/run", {
        symbol, strategy, params, period, initial_capital: capital,
      });
      setResult(res);
      setRunId(res.id);
      toast.success(`Backtest done: ${res.metrics.total_return_pct}% return`);
    } catch (e) {
      toast.error("Backtest failed", { description: (e as Error).message });
    } finally {
      setRunning(false);
    }
  };

  /* Equity + drawdown series (peak-to-trough %). */
  const chartData = (result?.equity_curve ?? []).map((p, i, arr) => {
    const peak = Math.max(...arr.slice(0, i + 1).map((x) => x.equity));
    return { date: p.date, equity: p.equity, dd: (p.equity / peak - 1) * 100 };
  });

  const exportCsv = () => {
    if (!result) return;
    const header = "entry,exit,side,qty,entry_price,exit_price,pnl,return_pct,costs";
    const rows = result.trades.map((t) =>
      [t.entry_time, t.exit_time, t.side, t.qty, t.entry_price, t.exit_price, t.pnl, t.return_pct, t.costs].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${symbol}_backtest_trades.csv`;
    a.click();
    toast.success("CSV exported");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold tracking-tight">Backtest Lab</h1>

      {/* Inputs */}
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-text-muted">
            Symbol (NSE)
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="mt-1 font-mono"
            />
          </label>
          <label className="text-xs text-text-muted">
            Strategy
            <Select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="mt-1">
              {(strategies?.strategies ?? ["ema_crossover"]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </label>
          <label className="text-xs text-text-muted">
            Period
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1">
              {["6mo", "1y", "2y", "5y", "max"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </label>
          <label className="text-xs text-text-muted">
            Initial Capital (₹)
            <Input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </label>

          {strategy === "ema_crossover" && (
            <>
              <label className="text-xs text-text-muted">
                Fast EMA
                <Input type="number" value={fast} onChange={(e) => setFast(Number(e.target.value))} className="mt-1 font-mono" />
              </label>
              <label className="text-xs text-text-muted">
                Slow EMA
                <Input type="number" value={slow} onChange={(e) => setSlow(Number(e.target.value))} className="mt-1 font-mono" />
              </label>
            </>
          )}

          <div className="flex items-end gap-2 lg:col-span-2">
            <Button onClick={run} disabled={running} className="neon-active">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Backtest
            </Button>
            {result && (
              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {running && <Skeleton className="h-40 w-full" />}

      {result && (
        <>
          {/* Stats tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {STATS.map(({ key, label, pct }) => {
              const v = result.metrics[key] ?? 0;
              return (
                <div key={key} className="glass-card p-3">
                  <div className="text-[11px] text-text-muted">{label}</div>
                  <div
                    className={cn(
                      "font-mono text-lg font-bold tabular",
                      pct ? pctClass(v as number) : "text-foreground"
                    )}
                  >
                    {pct ? `${v}%` : v}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Equity curve */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Equity Curve</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" stroke="#1F2937" fontSize={10} tickFormatter={(d) => d.slice(2, 7)} />
                  <YAxis stroke="#1F2937" fontSize={10} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #1F2937", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#9CA3AF" }}
                  />
                  <Line type="monotone" dataKey="equity" stroke="#00E5FF" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Drawdown area chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Drawdown %</CardTitle>
            </CardHeader>
            <CardContent className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <XAxis dataKey="date" stroke="#1F2937" fontSize={10} tickFormatter={(d) => d.slice(2, 7)} />
                  <YAxis stroke="#1F2937" fontSize={10} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #1F2937", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#9CA3AF" }}
                  />
                  <Area type="monotone" dataKey="dd" stroke="#FF3B5C" fill="rgba(255,59,92,0.25)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {!result && !running && (
        <p className="text-center text-sm text-text-muted">
          Run a backtest on real Yahoo data to see equity curve, drawdown, and trades.
        </p>
      )}
    </div>
  );
}
