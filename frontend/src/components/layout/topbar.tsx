"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, Zap, ShieldAlert, Menu, LogOut } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ThemeToggle } from "@/components/layout/providers";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Topbar: menu | search | market clock | Paper/Live toggle | notif | user
--------------------------------------------------------------------------- */

/** IST market status pill: OPEN / CLOSED with pulse animation. */
function MarketClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const ist = now
    ? new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    : null;
  const mins = ist ? ist.getHours() * 60 + ist.getMinutes() : 0;
  const day = ist ? ist.getDay() : 0;
  const isOpen = day >= 1 && day <= 5 && mins >= 555 && mins < 930; // 9:15-15:30
  const label = isOpen ? "MARKET OPEN" : "MARKET CLOSED";

  return (
    <div className="hidden items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1.5 md:flex">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          isOpen ? "bg-success animate-pulse_live" : "bg-danger"
        )}
        aria-hidden
      />
      <span className="text-xs font-semibold tracking-wide text-text-muted">
        {label}
      </span>
      <span className="font-mono text-xs tabular text-foreground">
        {ist ? ist.toLocaleTimeString("en-GB", { hour12: false }) : "--:--:--"} IST
      </span>
    </div>
  );
}

/** Paper/Live segmented toggle — Live requires explicit confirm (2FA in Phase 3). */
function ModeToggle() {
  const { tradingMode, setTradingMode } = useAppStore();
  const router = useRouter();

  const toggle = () => {
    if (tradingMode === "paper") {
      const ok = window.confirm(
        "⚠️ LIVE TRADING MODE\n\nReal money will be at risk. Orders go to your broker.\n\nContinue?"
      );
      if (!ok) return;
      setTradingMode("live");
      router.push("/dashboard/live");
    } else {
      setTradingMode("paper");
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${tradingMode === "paper" ? "live" : "paper"} mode`}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold tracking-wide transition-all duration-200",
        tradingMode === "paper"
          ? "border-primary/50 bg-primary/10 text-primary shadow-glow-sm"
          : "border-danger/60 bg-danger/15 text-danger shadow-glow-danger"
      )}
    >
      {tradingMode === "live" ? (
        <ShieldAlert className="h-4 w-4" aria-hidden />
      ) : (
        <Zap className="h-4 w-4" aria-hidden />
      )}
      {tradingMode.toUpperCase()}
    </button>
  );
}

/** Full-width red banner when Live mode is active (spec security requirement). */
function LiveBanner() {
  const tradingMode = useAppStore((s) => s.tradingMode);
  if (tradingMode !== "live") return null;
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-danger py-1 text-xs font-bold tracking-widest text-white">
      <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
      LIVE TRADING ACTIVE — REAL MONEY AT RISK
    </div>
  );
}

interface TopbarProps {
  onMenu: () => void;
}

export function Topbar({ onMenu }: TopbarProps) {
  const { session, setSession } = useAppStore();
  const [q, setQ] = useState("");

  const logout = async () => {
    try {
      await apiPost("/auth/logout");
    } catch {
      /* session already gone */
    }
    setSession(null);
    window.location.href = "/login";
  };

  return (
    <>
      <LiveBanner />
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md">
        <button
          className="rounded-md p-1.5 text-text-muted hover:text-primary lg:hidden"
          onClick={onMenu}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search with ⌘K hint */}
        <div className="relative min-w-0 flex-1 max-w-md">
          <Search
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search symbol…  (Ctrl+K)"
            className="h-9 w-full rounded-lg border border-border bg-background/60 pl-9 pr-14 text-sm
              placeholder:text-text-muted focus:border-primary/60 focus:outline-none focus:shadow-glow-sm transition"
            aria-label="Search symbols"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted">
            ⌘K
          </kbd>
        </div>

        <MarketClock />
        <ModeToggle />
        <ThemeToggle />

        <button
          className="relative rounded-lg p-2 text-text-muted transition hover:bg-white/5 hover:text-primary"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger animate-pulse_live" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {(session?.name ?? "G").charAt(0).toUpperCase()}
          </div>
          <span className="hidden text-sm text-text-muted md:inline">
            {session?.name ?? "Guest"}
          </span>
          <button
            onClick={logout}
            className="rounded-md p-1.5 text-text-muted hover:text-danger"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
    </>
  );
}


