"use client";

import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { OrderTicket } from "@/components/trading/order-ticket";
import { CandlestickChart } from "@/components/chart/candlestick-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { pctClass } from "@/lib/utils";

/* Paper trading terminal (spec route /dashboard/paper). */

interface OpenOrder {
  order_id: string;
  symbol: string;
  side: string;
  qty: number;
  status: string;
  ts: string;
}

export default function PaperPage() {
  const symbol = useAppStore((s) => s.symbol);

  const { data: orders } = useQuery({
    queryKey: ["orders", "paper"],
    queryFn: () => apiGet<{ orders: OpenOrder[] }>("/api/orders?mode=paper"),
    refetchInterval: 8000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight">Paper Trading</h1>
        <Badge variant="success">
          <Radio className="mr-1 h-3 w-3" /> SIMULATED — NO REAL MONEY
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <CandlestickChart symbol={symbol} height={420} />

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Recent Paper Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {!orders?.orders.length ? (
                <p className="py-4 text-center text-sm text-text-muted">
                  Koi paper order nahi — order ticket se place karein.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-text-muted">
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Symbol</th>
                      <th className="py-2 pr-3">Side</th>
                      <th className="py-2 pr-3 text-right">Qty</th>
                      <th className="py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular">
                    {orders.orders.map((o) => (
                      <tr key={o.order_id} className="border-b border-border/40">
                        <td className="py-2 pr-3">{o.ts.slice(11, 19)}</td>
                        <td className="py-2 pr-3 font-semibold">{o.symbol}</td>
                        <td className={o.side === "BUY" ? "py-2 pr-3 text-success" : "py-2 pr-3 text-danger"}>
                          {o.side}
                        </td>
                        <td className="py-2 pr-3 text-right">{o.qty}</td>
                        <td className="py-2 text-right">{o.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <OrderTicket mode="paper" />
      </div>
    </div>
  );
}
