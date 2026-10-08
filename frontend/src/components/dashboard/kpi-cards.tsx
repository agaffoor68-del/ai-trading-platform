"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Wallet } from "lucide-react";
import { cn, pctClass } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/* ---------------------------------------------------------------------------
   KPI cards: animated counters + sparklines + up/down color flash.
--------------------------------------------------------------------------- */

/** Eased count-up animation for numeric values. */
function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

/** Tiny inline sparkline (SVG polyline). */
function Sparkline({
  data,
  positive,
}: {
  data: number[];
  positive: boolean;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 30 - ((v - min) / range) * 28 - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 30"
      className="h-8 w-24 shrink-0"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke={positive ? "#00FF9D" : "#FF3B5C"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface KpiCardProps {
  label: string;
  value: number;
  format: (v: number) => string;
  deltaPct?: number;
  spark?: number[];
  icon: React.ReactNode;
}

export function KpiCard({
  label,
  value,
  format,
  deltaPct,
  spark,
  icon,
}: KpiCardProps) {
  const animated = useCountUp(value);
  const positive = (deltaPct ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="text-primary/80">{icon}</span>
              {label}
            </div>
            <div
              className={cn(
                "mt-1 truncate font-mono text-xl font-bold tabular transition-colors duration-200",
                positive ? "text-foreground" : "text-foreground"
              )}
            >
              {format(animated)}
            </div>
            {deltaPct !== undefined && (
              <div
                className={cn(
                  "mt-0.5 flex items-center gap-1 text-xs font-medium tabular",
                  pctClass(deltaPct)
                )}
              >
                {positive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {deltaPct >= 0 ? "+" : ""}
                {deltaPct.toFixed(2)}% today
              </div>
            )}
          </div>
          {spark && <Sparkline data={spark} positive={positive} />}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** Convenience wrapper exporting the 4 spec KPI tiles. */
export function KpiRow({
  portfolio,
  todayPnl,
  todayPnlPct,
  winRate,
  activePositions,
  portfolioSpark,
  pnlSpark,
}: {
  portfolio: number;
  todayPnl: number;
  todayPnlPct: number;
  winRate: number;
  activePositions: number;
  portfolioSpark?: number[];
  pnlSpark?: number[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Portfolio Value"
        value={portfolio}
        format={(v) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
        deltaPct={todayPnlPct}
        spark={portfolioSpark}
        icon={<Wallet className="h-3.5 w-3.5" />}
      />
      <KpiCard
        label="Today's P&L"
        value={todayPnl}
        format={(v) =>
          `${v >= 0 ? "+" : "-"}₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
        }
        deltaPct={todayPnlPct}
        spark={pnlSpark}
        icon={<Activity className="h-3.5 w-3.5" />}
      />
      <KpiCard
        label="Win Rate"
        value={winRate}
        format={(v) => `${v.toFixed(1)}%`}
        deltaPct={undefined}
        spark={undefined}
        icon={<TrendingUp className="h-3.5 w-3.5" />}
      />
      <KpiCard
        label="Active Positions"
        value={activePositions}
        format={(v) => `${Math.round(v)}`}
        deltaPct={undefined}
        spark={undefined}
        icon={<Activity className="h-3.5 w-3.5" />}
      />
    </div>
  );
}
