"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api";
import { cn, pctClass } from "@/lib/utils";
import { toast } from "sonner";

interface Entry {
  id: string;
  date: string;
  symbol: string;
  side: string;
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  strategy: string;
  notes: string;
}

/* AlphaTradePro trade journal. */
export default function JournalPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    symbol: "RELIANCE", side: "BUY", qty: "10",
    entry: "", exit: "", strategy: "manual", notes: "",
  });
  const { data } = useQuery({
    queryKey: ["journal"],
    queryFn: () => apiGet<{ entries: Entry[]; total: number }>("/api/journal?limit=200"),
  });
  const { data: attr } = useQuery({
    queryKey: ["attribution"],
    queryFn: () => apiGet<{ total_trades: number; total_pnl: number;
      by_strategy: Record<string, { trades: number; win_rate: number; pnl: number }> }>(
      "/api/journal/attribution"),
  });
  const add = useMutation({
    mutationFn: () => apiPost("/api/journal", {
      symbol: form.symbol, side: form.side, qty: Number(form.qty),
      entry: Number(form.entry), exit: Number(form.exit),
      strategy: form.strategy, notes: form.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal"] });
      qc.invalidateQueries({ queryKey: ["attribution"] });
      toast.success("Journal entry saved");
      setForm((f) => ({ ...f, entry: "", exit: "", notes: "" }));
    },
    onError: (e: Error) => toast.error("Save failed", { description: e.message }),
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold tracking-tight">Trade Journal</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-foreground">Log a trade</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Input value={form.symbol} onChange={set("symbol")} placeholder="Symbol" />
              <select value={form.side} onChange={set("side")} className="h-9 rounded-lg border border-border bg-background/60 px-2 text-sm">
                <option>BUY</option>
                <option>SELL</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input value={form.qty} onChange={set("qty")} placeholder="Qty" type="number" />
              <Input value={form.entry} onChange={set("entry")} placeholder="Entry" type="number" />
              <Input value={form.exit} onChange={set("exit")} placeholder="Exit" type="number" />
            </div>
            <Input value={form.strategy} onChange={set("strategy")} placeholder="Strategy" />
            <Input value={form.notes} onChange={set("notes")} placeholder="Notes / lesson" />
            <Button className="w-full" disabled={add.isPending || !form.entry || !form.exit} onClick={() => add.mutate()}>
              {add.isPending ? "Saving…" : "Save entry"}
            </Button>
          </CardContent>
        </Card>
        <AttrCard attr={attr} />
      </div>
      <EntriesCard entries={data?.entries ?? []} />
    </div>
  );
}

function AttrCard({ attr }: { attr?: { total_trades: number; total_pnl: number;
  by_strategy: Record<string, { trades: number; win_rate: number; pnl: number }> } }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle className="text-foreground">Attribution</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-text-muted">
          {attr?.total_trades ?? 0} trades ·{" "}
          <span className={cn("font-mono font-bold", pctClass(attr?.total_pnl ?? 0))}>
            {attr ? `${attr.total_pnl >= 0 ? "+" : "−"}₹${Math.abs(attr.total_pnl).toFixed(0)}` : "—"}
          </span>{" "}total
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(attr?.by_strategy ?? {}).map(([name, b]) => (
            <div key={name} className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">{name}</p>
              <p className="font-mono text-xs text-text-muted tabular">
                {b.trades} trades · {b.win_rate}% WR ·{" "}
                <span className={pctClass(b.pnl)}>{b.pnl >= 0 ? "+" : "−"}₹{Math.abs(b.pnl).toFixed(0)}</span>
              </p>
            </div>
          ))}
          {!Object.keys(attr?.by_strategy ?? {}).length && (
            <p className="text-sm text-text-muted">No entries yet — log your first trade.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EntriesCard({ entries }: { entries: Entry[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-foreground">Entries</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Symbol</th>
                <th className="py-2 pr-3">Side</th>
                <th className="py-2 pr-3">Strategy</th>
                <th className="py-2 pr-3 text-right">P&L</th>
                <th className="py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/40">
                  <td className="py-2 pr-3">{e.date}</td>
                  <td className="py-2 pr-3 font-semibold">{e.symbol}</td>
                  <td className={e.side === "BUY" ? "py-2 pr-3 text-success" : "py-2 pr-3 text-danger"}>{e.side}</td>
                  <td className="py-2 pr-3">{e.strategy}</td>
                  <td className={cn("py-2 pr-3 text-right font-semibold", pctClass(e.pnl))}>
                    {e.pnl >= 0 ? "+" : "−"}₹{Math.abs(e.pnl).toFixed(0)}
                  </td>
                  <td className="max-w-[240px] truncate py-2 font-sans">{e.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!entries.length && (
            <p className="py-6 text-center text-sm text-text-muted">Journal empty.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

