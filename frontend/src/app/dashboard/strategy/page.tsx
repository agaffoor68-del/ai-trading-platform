"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, Swords } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPost } from "@/lib/api";

/* Strategy builder + AI suggestions (spec route /dashboard/strategy). */

interface StrategyRow {
  id: string;
  name: string;
  kind: string;
  status: "draft" | "paper" | "live" | "paused";
  win_rate: number;
  sharpe: number;
}

export default function StrategyPage() {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    name: string;
    code: string;
    explanation: string;
  } | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["strategy-list"],
    queryFn: () => apiGet<{ strategies: StrategyRow[] }>("/api/strategy/list"),
  });

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const res = await apiPost<{ name: string; code: string; explanation: string }>(
        "/api/ai/generate-strategy",
        { prompt }
      );
      setSuggestion(res);
      toast.success("AI strategy generated — review & save");
    } catch (e) {
      toast.error("Generation failed", {
        description: (e as Error).message + " — LLM key Settings me add kijiye.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!suggestion) return;
    try {
      await apiPost("/api/strategy/create", suggestion);
      toast.success("Strategy saved");
      refetch();
      setSuggestion(null);
    } catch (e) {
      toast.error("Save failed", { description: (e as Error).message });
    }
  };

  const deploy = async (id: string) => {
    try {
      await apiPost(`/api/strategy/${id}/deploy`, { target: "paper" });
      toast.success("Deployed to paper trading");
      refetch();
    } catch (e) {
      toast.error("Deploy failed", { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold tracking-tight">Strategy Builder</h1>

      {/* AI generator */}
      <div className="ai-panel">
        <div className="ai-panel-inner">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Strategy Generator
          </h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "NIFTY intraday: RSI oversold + supertrend confirm, 2% risk"'
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && generate()}
            />
            <Button onClick={generate} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate
            </Button>
          </div>

          {suggestion && (
            <div className="mt-3 rounded-lg border border-border bg-background/50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-primary">
                  {suggestion.name}
                </span>
                <Button size="sm" onClick={save}>
                  Save Strategy
                </Button>
              </div>
              <p className="mb-2 text-xs text-text-muted">{suggestion.explanation}</p>
              <pre className="max-h-40 overflow-auto rounded bg-background p-2 text-[11px] text-text-muted">
                {suggestion.code}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Strategy registry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">My Strategies</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.strategies.length ? (
            <p className="py-6 text-center text-sm text-text-muted">
              No strategies yet — upar AI se generate karein ya Backtest Lab me test karein.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4 text-right">Win %</th>
                    <th className="py-2 pr-4 text-right">Sharpe</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular">
                  {data.strategies.map((s) => (
                    <tr key={s.id} className="border-b border-border/40">
                      <td className="py-2.5 pr-4 font-semibold">{s.name}</td>
                      <td className="py-2.5 pr-4">{s.kind}</td>
                      <td className="py-2.5 pr-4">
                        <Badge
                          variant={
                            s.status === "live"
                              ? "danger"
                              : s.status === "paper"
                                ? "success"
                                : "outline"
                          }
                        >
                          {s.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-right">{s.win_rate.toFixed(1)}</td>
                      <td className="py-2.5 pr-4 text-right">{s.sharpe.toFixed(2)}</td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="outline" onClick={() => deploy(s.id)}>
                          <Swords className="h-3 w-3" /> Deploy
                        </Button>
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
