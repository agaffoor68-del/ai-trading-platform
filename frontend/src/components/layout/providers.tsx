"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { CommandPalette } from "@/components/layout/command-palette";

/* Global client providers: TanStack Query + Ctrl+K palette. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <CommandPalette />
    </QueryClientProvider>
  );
}

/* Dark/light toggle for the topbar. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const dark = theme !== "light";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      title={dark ? "Light mode" : "Dark mode"}
      aria-label="Toggle theme"
      className="rounded-lg border border-border p-2 text-text-muted transition hover:border-primary/50 hover:text-foreground"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
