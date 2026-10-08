"use client";

import { create } from "zustand";

/* ---------------------------------------------------------------------------
   Global app store (Zustand):
   - auth session (populated by /auth/me)
   - paper/live trading mode
   - selected symbol/timeframe (shared across chart + panels)
   - live tick cache for flash animations
--------------------------------------------------------------------------- */

export interface Session {
  email: string;
  name: string;
  picture?: string;
  mode: "demo" | "google";
}

export interface Tick {
  symbol: string;
  price: number;
  change_pct: number;
  volume: number;
  ts: number;
}

interface AppState {
  session: Session | null;
  setSession: (s: Session | null) => void;

  /** Paper vs Live — persisted to localStorage. */
  tradingMode: "paper" | "live";
  setTradingMode: (m: "paper" | "live") => void;

  symbol: string;
  setSymbol: (s: string) => void;
  timeframe: string;
  setTimeframe: (tf: string) => void;

  ticks: Record<string, Tick>;
  upsertTick: (t: Tick) => void;
}

export const useAppStore = create<AppState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),

  tradingMode: "paper",
  setTradingMode: (tradingMode) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("trading_mode", tradingMode);
    }
    set({ tradingMode });
  },

  symbol: "RELIANCE",
  setSymbol: (symbol) => set({ symbol }),
  timeframe: "1d",
  setTimeframe: (timeframe) => set({ timeframe }),

  ticks: {},
  upsertTick: (t) =>
    set((state) => ({ ticks: { ...state.ticks, [t.symbol]: t } })),
}));
