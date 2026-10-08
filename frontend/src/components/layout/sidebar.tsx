"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LineChart,
  CandlestickChart,
  FlaskConical,
  Swords,
  Radio,
  Wallet,
  History,
  BrainCircuit,
  Newspaper,
  Settings,
  Bot,
  ChevronLeft,
  Target,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* Navigation items — spec ke 14 routes (login/landing alag hain). */
const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/market", label: "Market Watch", icon: LineChart },
  { href: "/dashboard/chart", label: "Chart", icon: CandlestickChart },
  { href: "/dashboard/backtest", label: "Backtest", icon: FlaskConical },
  { href: "/dashboard/strategy", label: "Strategy", icon: Swords },
  { href: "/dashboard/paper", label: "Paper Trading", icon: Radio },
  { href: "/dashboard/live", label: "Live Trading", icon: Wallet },
  { href: "/dashboard/positions", label: "Positions", icon: Wallet },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/options", label: "Options", icon: Target },
  { href: "/dashboard/journal", label: "Journal", icon: BookOpen },
  { href: "/dashboard/ai", label: "AI Insights", icon: BrainCircuit },
  { href: "/dashboard/news", label: "News", icon: Newspaper },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Fixed left sidebar — collapsible, neon active state, mobile-ready. */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-surface/80 backdrop-blur-md",
        "transition-all duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-60",
        "max-lg:hidden"
      )}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 shadow-glow-sm">
          <Bot className="h-5 w-5 text-primary" aria-hidden />
        </div>
        {!collapsed && (
          <span className="truncate text-lg font-bold tracking-tight">
            Alpha<span className="text-primary">TradePro</span>
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2 scrollbar-thin">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === href
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                active
                  ? "bg-primary/10 text-primary shadow-glow-sm border border-primary/30"
                  : "text-text-muted hover:bg-white/5 hover:text-foreground border border-transparent"
              )}
            >
              <Icon className="h-4.5 w-4.5 h-[18px] w-[18px] shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex h-10 items-center justify-center border-t border-border text-text-muted transition-colors hover:text-primary"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            collapsed && "rotate-180"
          )}
        />
      </button>
    </aside>
  );
}
