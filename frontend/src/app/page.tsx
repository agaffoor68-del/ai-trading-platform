import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CandlestickChart,
  FlaskConical,
  LineChart,
  Shield,
  Sparkles,
} from "lucide-react";

/* Landing page — hero, features, CTA (spec route "/") */

const FEATURES = [
  {
    icon: CandlestickChart,
    title: "Pro Candlestick Charts",
    desc: "Neon TradingView charts: MA/BB/VWAP overlays, RSI pane, trade entry/exit markers with click popups.",
  },
  {
    icon: FlaskConical,
    title: "Real-Data Backtesting",
    desc: "Every backtest runs on real Yahoo Finance NSE data with India-cost modelling: STT, GST, stamp duty, slippage.",
  },
  {
    icon: Bot,
    title: "AI Strategy Engine",
    desc: "LLM-generated strategies, walk-forward optimization, daily auto-deploy to paper trading.",
  },
  {
    icon: LineChart,
    title: "Paper → Live Trading",
    desc: "Risk-gated order terminal. Paper first, then broker live (Kite, Angel, Dhan, Kotak Neo).",
  },
  {
    icon: Sparkles,
    title: "Self-Learning Loop",
    desc: "Nightly scoring, auto-tuning, and strategy promotion — win-rate improves with every session.",
  },
  {
    icon: Shield,
    title: "SEBI-Conscious Design",
    desc: "30 orders/sec cap, 2FA for live, kill-switch, and per-trade risk limits built-in.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 shadow-glow-sm">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          Alpha<span className="text-primary">TradePro</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-text-muted transition hover:text-primary"
          >
            Dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow-sm transition hover:shadow-glow"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-4xl px-4 pb-20 pt-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 animate-pulse_live rounded-full bg-primary" />
          Institute-Level Algo Trading Platform
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Trade with an{" "}
          <span className="bg-ai-gradient bg-clip-text text-transparent">
            AI-Powered Edge
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted">
          Yahoo Finance data, AI backtesting, indicator optimization, paper + live
          execution across Indian brokers — with a dashboard that makes the market
          legible.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="group flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:shadow-glow"
          >
            Launch Dashboard
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
          <Link
            href="/dashboard/backtest"
            className="rounded-lg border border-border px-6 py-3 font-semibold text-foreground transition hover:border-primary/50 hover:text-primary"
          >
            Try Backtesting
          </Link>
        </div>
      </header>

      {/* Features grid */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-text-muted">
        Built for education & research. Trading involves risk — 9/10 F&O traders
        lose money (SEBI study). Paper trade first.
      </footer>
    </div>
  );
}
