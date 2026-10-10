"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type CandlestickData,
  type LineData,
  type SeriesMarker,
} from "lightweight-charts";
import { toast } from "sonner";
import { Camera, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/badge";

/* ---------------------------------------------------------------------------
   Candlestick chart — TradingView Lightweight Charts v4.
   Spec: green/red candles, volume pane, crosshair OHLC tooltip, timeframe
   selector, overlays (MA/BB/VWAP), trade markers (▲▼ + SL/Target lines),
   marker click popup, range selector, fullscreen, screenshot.
--------------------------------------------------------------------------- */

export interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TradeMarker {
  id: string;
  time: UTCTimestamp;
  type: "buy" | "sell" | "sl" | "target";
  price: number;
  meta?: {
    date: string;
    time: string;
    entryPrice: number;
    exitPrice: number | null;
    qty: number;
    pnl: number;
    duration: string;
    strategy: string;
  };
}

const TIMEFRAMES = [
  { label: "1m", tf: "1m" },
  { label: "5m", tf: "5m" },
  { label: "15m", tf: "15m" },
  { label: "1h", tf: "1h" },
  { label: "4h", tf: "4h" },
  { label: "1D", tf: "1d" },
  { label: "1W", tf: "1wk" },
] as const;

const RANGES = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;
const OVERLAYS = ["MA", "BB", "VWAP"] as const;

/** Backend candle row shape (GET /api/market/history/{symbol}). */
interface HistCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartProps {
  symbol: string;
  timeframe?: string;
  trades?: TradeMarker[];
  height?: number;
  onTimeframeChange?: (tf: string) => void;
}

export function CandlestickChart({
  symbol,
  timeframe = "1d",
  trades = [],
  height = 460,
  onTimeframeChange,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [tf, setTf] = useState(timeframe);
  const [activeOverlays, setActiveOverlays] = useState<string[]>(["MA"]);
  const [range, setRange] = useState<(typeof RANGES)[number]>("1Y");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeMarker | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [fullscreen, setFullscreen] = useState(false);

  /* -------------------------------------------------- chart initialization */
  const initChart = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9CA3AF",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(31,41,55,0.5)" },
        horzLines: { color: "rgba(31,41,55,0.5)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#00E5FF", width: 1, style: 3, labelBackgroundColor: "#00E5FF" },
        horzLine: { color: "#00E5FF", width: 1, style: 3, labelBackgroundColor: "#00E5FF" },
      },
      rightPriceScale: { borderColor: "#1F2937" },
      timeScale: { borderColor: "#1F2937", timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00FF9D",
      downColor: "#FF3B5C",
      borderUpColor: "#00FF9D",
      borderDownColor: "#FF3B5C",
      wickUpColor: "#00FF9D",
      wickDownColor: "#FF3B5C",
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const markerSeries = chart.addLineSeries({
      visible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    markerSeriesRef.current = markerSeries;

    // Crosshair OHLC tooltip
    chart.subscribeCrosshairMove((param) => {
      const tip = tooltipRef.current;
      if (!tip) return;
      if (
        !param.time ||
        !param.point ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        tip.style.display = "none";
        return;
      }
      const d = param.seriesData.get(candleSeries) as CandlestickData | undefined;
      if (!d) return;
      tip.style.display = "block";
      tip.style.left = `${Math.min(param.point.x + 16, el.clientWidth - 190)}px`;
      tip.style.top = `${param.point.y + 16}px`;
      const up = d.close >= d.open;
      tip.innerHTML =
        `<div style="font-family:monospace;font-size:11px;line-height:1.6">` +
        `<div style="color:#9CA3AF">${new Date((param.time as number) * 1000).toLocaleString("en-IN")}</div>` +
        `<div style="color:${up ? "#00FF9D" : "#FF3B5C"}">` +
        `O ${d.open.toFixed(2)}  H ${d.high.toFixed(2)}<br/>` +
        `L ${d.low.toFixed(2)}  C ${d.close.toFixed(2)}</div></div>`;
    });

    // Click near a trade time → popup with entry/exit details
    chart.subscribeClick((param) => {
      if (!param.point) return;
      const t = param.time as UTCTimestamp;
      const nearest = trades.find((m) => Math.abs(m.time - t) <= 86400 * 3);
      if (nearest?.meta) setSelectedTrade(nearest);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  /* Init on mount + cleanup */
  useEffect(() => {
    initChart();
    return () => {
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [initChart]);

  /* Resize observer */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      chartRef.current?.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* -------------------------------------------------- data loading
     GET /api/market/history/{symbol}?tf=&range= (LW-Charts native shape) */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/market/history/${encodeURIComponent(symbol)}?tf=${tf}&range=${range}`, {
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { candles: HistCandle[] }) => {
        if (cancelled) return;
        setCandles(
          data.candles.map((row) => ({
            time: row.time as UTCTimestamp,
            open: row.open,
            high: row.high,
            low: row.low,
            close: row.close,
            volume: row.volume,
          }))
        );
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
        toast.error("Failed to load chart data", { description: err.message });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, tf, range]);

  /* Apply candle + volume data */
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;
    candleSeriesRef.current.setData(candles);

    volumeSeriesRef.current?.setData(
      candles.map((c) => ({
        time: c.time,
        value: (c as Candle & { volume?: number }).volume ?? 0,
        color:
          c.close >= c.open ? "rgba(0,255,157,0.35)" : "rgba(255,59,92,0.35)",
      }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  /* Overlay indicator series (MA / BB / VWAP) — recreate on toggle */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || candles.length === 0) return;
    const store = chart as unknown as { _overlays?: ISeriesApi<"Line">[] };
    store._overlays?.forEach((s) => chart.removeSeries(s));
    store._overlays = [];

    const addLine = (data: LineData[], color: string) => {
      if (data.length === 0) return;
      const s = chart.addLineSeries({
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(data);
      store._overlays?.push(s);
    };

    if (activeOverlays.includes("MA")) {
      addLine(sma(candles, 20), "#00E5FF");
      addLine(sma(candles, 50), "#FFB800");
      addLine(sma(candles, 200), "#7C3AED");
    }
    if (activeOverlays.includes("BB")) {
      const { upper, lower } = bollingerCalc(candles, 20, 2);
      addLine(upper, "rgba(0,229,255,0.6)");
      addLine(lower, "rgba(0,229,255,0.6)");
    }
    if (activeOverlays.includes("VWAP")) {
      addLine(vwapCalc(candles), "#FF3B5C");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOverlays, candles]);

  /* Trade markers: ▲▼ arrows + SL (dashed) / Target (dotted) lines */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const store = chart as unknown as { _markLines?: ISeriesApi<"Line">[] };
    store._markLines?.forEach((s) => chart.removeSeries(s));
    store._markLines = [];

    trades
      .filter((m) => m.type === "sl" || m.type === "target")
      .forEach((m) => {
        const s = chart.addLineSeries({
          color: m.type === "sl" ? "#FF3B5C" : "#00FF9D",
          lineWidth: 1,
          lineStyle: m.type === "sl" ? 2 : 3, // dashed : dotted
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        const tail = candles.filter((c) => c.time >= m.time);
        if (tail.length > 0) {
          s.setData(tail.map((c) => ({ time: c.time, value: m.price })));
          store._markLines?.push(s);
        }
      });

    const markers: SeriesMarker<UTCTimestamp>[] = trades
      .filter((m) => m.type === "buy" || m.type === "sell")
      .map((m) => ({
        time: m.time,
        position: m.type === "buy" ? "belowBar" : "aboveBar",
        color: m.type === "buy" ? "#00FF9D" : "#FF3B5C",
        shape: m.type === "buy" ? "arrowUp" : "arrowDown",
        text: m.type === "buy" ? "BUY" : "SELL",
      }));
    markers.sort((a, b) => a.time - b.time);
    markerSeriesRef.current?.setMarkers(markers as never);
  }, [trades, candles]);

  /* Screenshot: export chart canvas as PNG */
  const screenshot = () => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${symbol}_${tf}_chart.png`;
    a.click();
    toast.success("Screenshot saved");
  };

  return (
    <div
      className={cn(
        "glass-card relative flex flex-col overflow-hidden",
        fullscreen && "fixed inset-0 z-50 rounded-none"
      )}
    >
      {/* Toolbar: symbol | timeframes | overlays | range | actions */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="font-mono text-sm font-bold text-primary">{symbol}</span>

        <div className="flex rounded-md border border-border bg-background/60" role="group" aria-label="Timeframe">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.label}
              onClick={() => {
                setTf(t.tf);
                onTimeframeChange?.(t.tf);
              }}
              className={cn(
                "px-2 py-1 text-xs font-medium transition-colors",
                tf === t.tf
                  ? "bg-primary/15 text-primary shadow-glow-sm"
                  : "text-text-muted hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1" role="group" aria-label="Indicator overlays">
          {OVERLAYS.map((o) => (
            <button
              key={o}
              onClick={() =>
                setActiveOverlays((prev) =>
                  prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
                )
              }
              className={cn(
                "rounded border px-2 py-1 text-[11px] font-medium transition-colors",
                activeOverlays.includes(o)
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-text-muted hover:text-foreground"
              )}
            >
              {o}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <div className="flex rounded-md border border-border bg-background/60">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-2 py-1 text-[11px] font-medium transition-colors",
                  range === r
                    ? "bg-primary/15 text-primary"
                    : "text-text-muted hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <button onClick={screenshot} className="rounded p-1.5 text-text-muted hover:text-primary" aria-label="Screenshot">
            <Camera className="h-4 w-4" />
          </button>
          <button
            onClick={() => setFullscreen((f) => !f)}
            className="rounded p-1.5 text-text-muted hover:text-primary"
            aria-label="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <span className="animate-pulse_live text-xs text-text-muted">
              Loading {symbol}…
            </span>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
            <span className="text-sm text-danger">⚠ {error}</span>
            <span className="text-xs text-text-muted">
              Backend running? <code>uvicorn app.main:app</code>
            </span>
          </div>
        )}
        <div ref={containerRef} className="w-full" style={{ height }} />
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-20 hidden rounded-lg border border-border bg-surface/95 p-2 backdrop-blur"
        />
        {selectedTrade?.meta && (
          <TradePopup trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ trade popup */
function TradePopup({
  trade,
  onClose,
}: {
  trade: TradeMarker;
  onClose: () => void;
}) {
  const m = trade.meta!;
  return (
    <div className="absolute right-4 top-4 z-30 w-64 rounded-xl border border-primary/40 bg-surface/95 p-4 shadow-glow backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-bold",
            trade.type === "buy" ? "text-success" : "text-danger"
          )}
        >
          {trade.type === "buy" ? "▲ BUY ENTRY" : "▼ SELL ENTRY"}
        </span>
        <button onClick={onClose} className="text-text-muted hover:text-danger" aria-label="Close">
          ✕
        </button>
      </div>
      <dl className="mt-2 space-y-1 font-mono text-xs tabular">
        <PopupRow k="Date" v={m.date} />
        <PopupRow k="Time" v={m.time} />
        <PopupRow k="Entry" v={`₹${m.entryPrice.toFixed(2)}`} />
        <PopupRow k="Exit" v={m.exitPrice != null ? `₹${m.exitPrice.toFixed(2)}` : "OPEN"} />
        <PopupRow k="Qty" v={String(m.qty)} />
        <PopupRow
          k="P&L"
          v={`${m.pnl >= 0 ? "+" : "-"}₹${Math.abs(m.pnl).toFixed(0)}`}
          cls={m.pnl >= 0 ? "text-success" : "text-danger"}
        />
        <PopupRow k="Duration" v={m.duration} />
        <PopupRow k="Strategy" v={m.strategy} />
      </dl>
    </div>
  );
}

function PopupRow({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-text-muted">{k}</dt>
      <dd className={cn("text-foreground", cls)}>{v}</dd>
    </div>
  );
}

/* ------------------------------------------------------------ helpers */
/** Simple moving average of close. */
function sma(data: Candle[], p: number): LineData[] {
  const out: LineData[] = [];
  let sum = 0;
  data.forEach((c, i) => {
    sum += c.close;
    if (i >= p) sum -= data[i - p].close;
    if (i >= p - 1) out.push({ time: c.time, value: sum / p });
  });
  return out;
}

/** Bollinger bands (mid ± k·σ) aligned to sma output. */
function bollingerCalc(data: Candle[], p: number, k: number) {
  const mid = sma(data, p);
  const upper: LineData[] = [];
  const lower: LineData[] = [];
  mid.forEach((m, idx) => {
    const start = idx;
    const slice = data.slice(start, start + p);
    if (slice.length < p) return;
    const mean = m.value;
    const variance =
      slice.reduce((acc, c) => acc + (c.close - mean) ** 2, 0) / slice.length;
    const sd = Math.sqrt(variance);
    upper.push({ time: m.time, value: mean + k * sd });
    lower.push({ time: m.time, value: mean - k * sd });
  });
  return { upper, lower };
}

/** Session-anchored VWAP (resets daily). */
function vwapCalc(data: Candle[]): LineData[] {
  const out: LineData[] = [];
  let cumPV = 0;
  let cumV = 0;
  let lastDay = "";
  data.forEach((c) => {
    const day = new Date(c.time * 1000).toDateString();
    if (day !== lastDay) {
      cumPV = 0;
      cumV = 0;
      lastDay = day;
    }
    const typical = (c.high + c.low + c.close) / 3;
    const vol = 1_000_000; // placeholder weight (volume not carried in Candle)
    cumPV += typical * vol;
    cumV += vol;
    out.push({ time: c.time, value: cumPV / cumV });
  });
  return out;
}

