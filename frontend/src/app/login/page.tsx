"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { useAppStore } from "@/lib/store";

/* Login page — Google OAuth primary with demo fallback. */
export default function LoginPage() {
  const router = useRouter();
  const setSession = useAppStore((s) => s.setSession);
  const [loading, setLoading] = useState<string | null>(null);

  const googleLogin = async () => {
    setLoading("google");
    try {
      // Backend redirects to Google (or returns 501 if OAuth not configured)
      const res = await fetch("/auth/google", { credentials: "include" });
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.auth_url) {
        window.location.href = body.auth_url;
        return;
      }
      throw new Error(body.detail ?? "Google OAuth not configured yet");
    } catch (e) {
      toast.error("Google login unavailable", {
        description:
          e instanceof Error
            ? `${e.message} — Settings wizard se OAuth Client ID add karein, ya Demo use karein.`
            : "Unknown error",
      });
      setLoading(null);
    }
  };

  const demoLogin = async () => {
    setLoading("demo");
    try {
      const data = await apiPost<{ email: string; name: string; mode: string }>(
        "/auth/demo-login"
      );
      setSession({ email: data.email, name: data.name, mode: "demo" });
      toast.success("Welcome, " + data.name);
      router.push("/dashboard");
    } catch (e) {
      toast.error("Demo login failed", {
        description: e instanceof Error ? e.message : "Backend running?",
      });
      setLoading(null);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-card w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 shadow-glow">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Alpha<span className="text-primary">TradePro</span>
          </h1>
          <p className="text-sm text-text-muted">
            Sign in to your algo trading terminal
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={googleLogin}
            disabled={loading !== null}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 disabled:opacity-60"
          >
            {loading === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="relative py-2 text-center text-xs text-text-muted">
            <span className="relative z-10 bg-surface px-2">or</span>
            <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>

          <button
            onClick={demoLogin}
            disabled={loading !== null}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 text-sm font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-60"
          >
            {loading === "demo" && <Loader2 className="h-4 w-4 animate-spin" />}
            Enter Demo Terminal
          </button>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-text-muted">
          Google login is active. If Google rejects the redirect, add the current app URL plus{" "}
          <span className="text-primary">/auth/google/callback</span> to the OAuth client&apos;s authorized redirect URIs. Demo mode remains available for paper trading.
        </p>
      </div>
    </main>
  );
}
