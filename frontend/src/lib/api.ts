/**
 * API client — all backend calls go through Next.js rewrites (/api/* -> FastAPI)
 * Credentials included so JWT HttpOnly cookie flows.
 */
const BASE = "";

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const apiPost = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const apiGet = <T,>(path: string) => api<T>(path);

/** Connect to the live tick WebSocket with auto-reconnect. */
export function connectLiveTicks(
  onTick: (tick: LiveTick) => void,
  onStatus?: (connected: boolean) => void
): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 1000;

  const connect = () => {
    if (closed) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    // Next.js rewrites don't proxy WS in dev — hit backend directly as fallback.
    const url = `${proto}://${window.location.hostname}:8000/ws/live`;
    ws = new WebSocket(url);
    ws.onopen = () => {
      retry = 1000;
      onStatus?.(true);
    };
    ws.onmessage = (ev) => {
      try {
        onTick(JSON.parse(ev.data) as LiveTick);
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = () => {
      onStatus?.(false);
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
    onStatus?.(false);
    ws?.close();
  };
}

export interface LiveTick {
  symbol: string;
  price: number;
  change_pct: number;
  volume: number;
  ts: number;
}
