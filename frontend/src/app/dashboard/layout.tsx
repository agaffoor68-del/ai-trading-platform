"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAppStore } from "@/lib/store";
import { apiGet } from "@/lib/api";
import { Skeleton } from "@/components/ui/badge";

/* Protected dashboard shell: sidebar + topbar + session guard. */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, setSession, upsertTick } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  /* Session guard: GET /auth/me — redirect to /login if absent. */
  useEffect(() => {
    let alive = true;
    apiGet<{ email: string; name: string; mode: string }>("/auth/me")
      .then((me) => {
        if (!alive) return;
        setSession({ ...me, mode: me.mode as "demo" | "google" });
        setChecked(true);
      })
      .catch(() => {
        if (alive) router.replace("/login");
      });
    return () => {
      alive = false;
    };
  }, [router, setSession]);

  /* Subscribe to live tick WebSocket. */
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 1000;
    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${window.location.hostname}:8000/ws/live`);
      ws.onmessage = (ev) => {
        try {
          upsertTick(JSON.parse(ev.data));
        } catch {
          /* skip */
        }
      };
      ws.onclose = () => {
        if (!closed) {
          setTimeout(connect, retry);
          retry = Math.min(retry * 2, 15000);
        }
      };
      ws.onerror = () => ws?.close();
    };
    connect();
    return () => {
      closed = true;
      ws?.close();
    };
  }, [upsertTick]);

  if (!checked || !session) {
    return (
      <div className="flex min-h-screen flex-col gap-4 bg-background p-6">
        <Skeleton className="h-14 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[460px] w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={`transition-all duration-200 ${collapsed ? "lg:ml-[68px]" : "lg:ml-60"}`}
      >
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6" key={pathname}>
          {children}
        </main>
      </div>
    </div>
  );
}
