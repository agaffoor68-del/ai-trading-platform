"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, Newspaper, Radio } from "lucide-react";
import { KpiRow } from "@/components/dashboard/kpi-cards";
import {
  CandlestickChart,
  type TradeMarker,
} from "@/components/chart/candlestick-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Skeleton } from "@/components/ui/badge";
import { apiGet, apiPost } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { cn, pctClass } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Main dashboard (spec grid): KPI tiles → chart → AI insights + order book
   → positions table → AI learning log.
--------------------------------------------------------------------------- */

interface Position {
  symbol: string;
  side: "LONG" | "SHORT";
  qty: number;
  entry: number;
  ltp: number;
  pnl: number;
  mode: "paper" | "live";
}

interface AiInsight {
  bias: "Bullish" | "Bearish" | "Neutral";
  confidence: number;
  summary: string;
  top_picks: {
    symbol: string;
    confidence: number;
    entry: number;
    sl: number;
    target: number;
    reason: string;
  }[];
}

interface LearningLogEntry {
  time: string;
  text: string;
}

export default function DashboardPage() {
  const symbol = useAppStore((s) => s.symbol);
  const [trades, setTrades] = useState<TradeMarker[]>([]);

  const { data: kpis } = useQuery({
    queryKey: ["kpis"],
    queryFn: () =>
      apiGet<{
        portfolio_value: number;
        today_pnl: number;
        today_pnl_pct: number;
        win_rate: number;
        active_positions: number;
        portfolio_series: number[];
      }>("/api/positions/summary"),
    refetchInterval: 15000,
  });

  const { data: positions, isLoading: posLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: () => apiGet<{ positions: Position[] }>("/api/positions"),
    refetchInterval: 10000,
  });

  const { data: insights, isLoading: aiLoading } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: () => apiGet<AiInsight>("/api/ai/insights"),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: learningLog } = useQuery({
    queryKey: ["learning-log"],
    queryFn: () =>
      apiGet<{ entries: LearningLogEntry[] }>("/api/ai/learning-log"),
    refetchInterval: 60 * 60 * 1000,
  });

  const { data: tradesData } = useQuery({
    queryKey: ["chart-trades", symbol],
    queryFn: () =>
      apiGet<{ markers: TradeMarker[] }>(
        `/api/trades/history?symbol=${encodeURIComponent(symbol)}&as_markers=true`
      ),
  });

  useEffect(() => {
    if (tradesData?.markers) setTrades(tradesData.markers);
  }, [tradesData]);

  return (
    <div className="space-y-4">
      <KpiRow
        portfolio={kpis?.portfolio_value ?? 100000}
        todayPnl={kpis?.today_pnl ?? 0}
        todayPnlPct={kpis?.today_pnl_pct ?? 0}
        winRate={kpis?.win_rate ?? 0}
        activePositions={kpis?.active_positions ?? 0}
        portfolioSpark={kpis?.portfolio_series}
        pnlSpark={kpis?.portfolio_series?.map((v, i, a) => v - (a[i - 1] ?? v))}
      />

      <CandlestickChart symbol={symbol} trades={trades} height={440} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AiInsightsPanel insights={insights} loading={aiLoading} />
        <OrderBookPanel />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-foreground">Open Positions</CardTitle>
          <Badge variant="success">
            <Radio className="mr-1 h-3 w-3" /> LIVE P&L
          </Badge>
        </CardHeader>
        <CardContent>
          {posLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !positions?.positions.length ? (
            <EmptyState
              title="No open positions"
              desc="Paper terminal se trade place karein ya AI strategy deploy karein."
            />
          ) : (
            <PositionsTable positions={positions.positions} />
          )}
        </CardContent>
      </Card>

      <div className="ai-panel">
        <div className="ai-panel-inner">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <BrainCircuit className="h-4 w-4 text-primary" />
              AI Learning Log
            </h3>
            <Badge>Updated hourly</Badge>
          </div>
          <ul className="space-y-2 text-sm">
            {(learningLog?.entries ?? DEFAULT_LOG).map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 font-mono text-xs text-primary">
                  {e.time}
                </span>
                <span className="text-text-muted">{e.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ sub-components */

function AiInsightsPanel({
  insights,
  loading,
}: {
  insights?: AiInsight;
  loading: boolean;
}) {
  const deploy = async (symbol: string) => {
    const { toast } = await import("sonner");
    try {
      await apiPost("/api/strategy/deploy", { symbol, target: "paper" });
      toast.success(`${symbol} strategy deployed to PAPER trading`);
    } catch (e) {
      toast.error("Deploy failed", { description: (e as Error).message });
    }
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-inner flex h-full flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <BrainCircuit className="h-4 w-4 text-primary" />
            AI Insights
          </h3>
          {insights && (
            <Badge
              variant={
                insights.bias === "Bullish"
                  ? "success"
                  : insights.bias === "Bearish"
                    ? "danger"
                    : "warning"
              }
            >
              {insights.bias} · {insights.confidence}%
            </Badge>
          )}
        </div>

        {loading || !insights ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <p className="mb-3 text-sm leading-relaxed text-text-muted">
              {insights.summary}
            </p>
            <div className="space-y-2">
              {insights.top_picks.map((p) => (
                <div
                  key={p.symbol}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2"
                >
                  <div>
                    <div className="font-mono text-sm font-bold">{p.symbol}</div>
                    <div className="text-xs text-text-muted">
                      E ₹{p.entry} · SL ₹{p.sl} · T ₹{p.target}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ConfidenceRing value={p.confidence} />
                    <button
                      onClick={() => deploy(p.symbol)}
                      className="rounded-md border border-success/40 bg-success/10 px-2 py-1 text-[11px] font-semibold text-success transition hover:bg-success/20"
                    >
                      Deploy Paper
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Circular confidence meter (SVG ring). */
function ConfidenceRing({ value }: { value: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative h-10 w-10" title={`Confidence ${value}%`}>
      <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#1F2937" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="#00E5FF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-primary">
        {value}
      </span>
    </div>
  );
}

/** Live depth chart (bid/ask) — from backend market depth endpoint. */
function OrderBookPanel() {
  const symbol = useAppStore((s) => s.symbol);
  const { data } = useQuery({
    queryKey: ["orderbook"],
    queryFn: () =>
      apiGet<{
        bids: { price: number; qty: number }[];
        asks: { price: number; qty: number }[];
      }>(`/api/market/depth?symbol=${symbol}`),
    refetchInterval: 5000,
  });

  const bids = data?.bids?.slice(0, 5) ?? [];
  const asks = data?.asks?.slice(0, 5) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Order Book · Depth</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 font-mono text-xs tabular">
        <div>
          <div className="mb-1 grid grid-cols-2 text-text-muted">
            <span>Bid Qty</span>
            <span className="text-right">Bid</span>
          </div>
          {bids.length === 0 && <Skeleton className="h-24 w-full" />}
          {bids.map((b, i) => (
            <div key={i} className="relative grid grid-cols-2 py-0.5">
              <div
                className="absolute inset-y-0 left-0 bg-success/10"
                style={{ width: `${Math.min((b.qty / 5000) * 100, 100)}%` }}
              />
              <span className="relative text-success">{b.qty}</span>
              <span className="relative text-right text-success">
                {b.price.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 grid grid-cols-2 text-text-muted">
            <span className="text-right">Ask</span>
            <span className="text-right">Ask Qty</span>
          </div>
          {asks.length === 0 && <Skeleton className="h-24 w-full" />}
          {asks.map((a, i) => (
            <div key={i} className="grid grid-cols-2 py-0.5">
              <span className="text-danger">{a.price.toFixed(2)}</span>
              <span className="text-right text-danger">{a.qty}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Color-coded live P&L positions table. */
function PositionsTable({ positions }: { positions: Position[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="py-2 pr-4">Symbol</th>
            <th className="py-2 pr-4">Side</th>
            <th className="py-2 pr-4 text-right">Qty</th>
            <th className="py-2 pr-4 text-right">Entry</th>
            <th className="py-2 pr-4 text-right">LTP</th>
            <th className="py-2 pr-4 text-right">P&L</th>
            <th className="py-2 text-right">Mode</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular">
          {positions.map((p) => (
            <tr
              key={p.symbol}
              className="border-b border-border/50 transition hover:bg-white/[0.03]"
            >
              <td className="py-2.5 pr-4 font-semibold">{p.symbol}</td>
              <td className="py-2.5 pr-4">
                <Badge variant={p.side === "LONG" ? "success" : "danger"}>
                  {p.side}
                </Badge>
              </td>
              <td className="py-2.5 pr-4 text-right">{p.qty}</td>
              <td className="py-2.5 pr-4 text-right">{p.entry.toFixed(2)}</td>
              <td className="py-2.5 pr-4 text-right">{p.ltp.toFixed(2)}</td>
              <td
                className={cn(
                  "py-2.5 pr-4 text-right font-semibold",
                  pctClass(p.pnl)
                )}
              >
                {p.pnl >= 0 ? "+" : "-"}₹{Math.abs(p.pnl).toFixed(0)}
              </td>
              <td className="py-2.5 text-right">
                <Badge variant={p.mode === "live" ? "danger" : "default"}>
                  {p.mode.toUpperCase()}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-8 text-center">
      <Newspaper className="h-8 w-8 text-border" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-text-muted">{desc}</p>
    </div>
  );
}

/* Fallback learning log (backend not reachable / first run). */
const DEFAULT_LOG: LearningLogEntry[] = [
  {
    time: "09:15",
    text: "Auto-deployed supertrend_follow (10,3) on PAPER — pre-market scan score 0.71",
  },
  {
    time: "12:00",
    text: "Midday check: NIFTY momentum fading, position target 50% → 25%",
  },
  {
    time: "15:30",
    text: "EOD review: 2/3 paper trades closed green. Rolling 30d win-rate: 58%.",
  },
  {
    time: "18:00",
    text: "Nightly tune queued: ema_crossover re-optimization on walk-forward folds.",
  },
];
