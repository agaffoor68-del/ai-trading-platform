"use client";

import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, Rocket } from "lucide-react";
import { toast } from "sonner";
import { ConfidenceRing } from "@/components/ai/confidence-ring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Skeleton } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Pick {
  symbol: string; confidence: number; entry: number;
  sl: number; target: number; reason: string;
}
interface Insights {
  bias: "Bullish" | "Bearish" | "Neutral"; confidence: number;
  summary: string; top_picks: Pick[]; engine: string;
}

export default function AiPage() {
  const setSymbol = useAppStore((s) => s.setSymbol);
  const { data, isLoading } = useQuery({
    queryKey: ["ai-page"],
    queryFn: () => apiGet<Insights>("/api/ai/insights"),
    refetchInterval: 5 * 60 * 1000,
  });
  const { data: log } = useQuery({
    queryKey: ["ai-log"],
    queryFn: () => apiGet<{ entries: { time: string; text: string }[] }>("/api/ai/learning-log"),
  });

  const deploy = async (symbol: string) => {
    try {
      await apiPost("/api/order/place", {
        symbol, qty: 1, side: "BUY", order_type: "MARKET", product: "MIS", mode: "paper",
      });
      toast.success(`${symbol} deployed to paper`);
    } catch (e) {
      toast.error("Deploy failed", { description: (e as Error).message });
    }
  };

  const biasColor = data?.bias === "Bullish" ? "text-success" : data?.bias === "Bearish" ? "text-danger" : "text-warning";

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <BrainCircuit className="h-5 w-5 text-primary" /> AI Insights
      </h1>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/[0.07] to-transparent">
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <ConfidenceRing value={data?.confidence ?? 50} />
            <div className="min-w-60 flex-1">
              <p className="text-xs uppercase tracking-widest text-text-muted">Daily Market Bias</p>
              <p className={cn("text-2xl font-bold", biasColor)}>{data?.bias}</p>
              <p className="mt-1 text-sm text-text-muted">{data?.summary}</p>
              <p className="mt-1 text-[11px] text-text-muted">Engine: {data?.engine}</p>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {(data?.top_picks ?? []).map((p) => (
          <Card key={p.symbol}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="font-mono text-foreground">{p.symbol}</CardTitle>
              <Badge variant={p.confidence >= 60 ? "success" : p.confidence <= 40 ? "danger" : "warning"}>
                {p.confidence}%
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="rounded border border-border p-2">
                  <p className="text-text-muted">Entry</p><p className="font-bold">₹{p.entry.toFixed(2)}</p>
                </div>
                <div className="rounded border border-danger/40 bg-danger/5 p-2">
                  <p className="text-text-muted">SL</p><p className="font-bold text-danger">₹{p.sl.toFixed(2)}</p>
                </div>
                <div className="rounded border border-success/40 bg-success/5 p-2">
                  <p className="text-text-muted">Target</p><p className="font-bold text-success">₹{p.target.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-text-muted">
                <span className="font-semibold text-foreground">Why: </span>{p.reason}
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => deploy(p.symbol)}>
                  <Rocket className="h-3.5 w-3.5" /> Deploy to Paper
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setSymbol(p.symbol); window.location.href = "/dashboard/chart"; }}>
                  View Chart
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-foreground">AI Learning Log</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(log?.entries ?? []).map((e, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="font-mono text-xs text-primary">{e.time}</span>
              <span className="text-text-muted">{e.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
