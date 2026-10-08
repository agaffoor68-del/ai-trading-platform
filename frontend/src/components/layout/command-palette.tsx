"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard, LineChart, CandlestickChart as CandleIcon, FlaskConical, BrainCircuit,
  Newspaper, FileText, Wallet, History, Radio, Plug, Settings,
} from "lucide-react";

/* Command palette (Ctrl+K) — quick nav + actions. */

const ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Market Watch", href: "/dashboard/market", icon: LineChart },
  { label: "Chart", href: "/dashboard/chart", icon: CandleIcon },
  { label: "Backtest Lab", href: "/dashboard/backtest", icon: FlaskConical },
  { label: "Strategy Builder", href: "/dashboard/strategy", icon: BrainCircuit },
  { label: "Paper Trading", href: "/dashboard/paper", icon: Radio },
  { label: "Live Trading", href: "/dashboard/live", icon: Plug },
  { label: "Positions", href: "/dashboard/positions", icon: Wallet },
  { label: "Trade History", href: "/dashboard/history", icon: History },
  { label: "AI Insights", href: "/dashboard/ai", icon: BrainCircuit },
  { label: "News", href: "/dashboard/news", icon: Newspaper },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Landing", href: "/", icon: FileText },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[15vh]"
         onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()}
           className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        <Command label="Quick actions" className="bg-transparent">
          <Command.Input
            autoFocus
            placeholder="Type a command — dashboard, backtest, AI…"
            className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-text-muted"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-6 text-center text-sm text-text-muted">
              Koi match nahi.
            </Command.Empty>
            {ITEMS.map((item) => (
              <Command.Item
                key={item.href + item.label}
                value={item.label}
                onSelect={() => { setOpen(false); router.push(item.href); }}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-muted aria-selected:bg-primary/10 aria-selected:text-foreground"
              >
                <item.icon className="h-4 w-4 text-primary" />
                {item.label}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
