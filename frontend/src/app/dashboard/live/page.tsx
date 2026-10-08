"use client";

import { ShieldAlert, Plug } from "lucide-react";
import { OrderTicket } from "@/components/trading/order-ticket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/* Live trading terminal (spec route /dashboard/live).
   Broker adapters are Phase 3 — UI shows connection state. */
export default function LivePage() {
  const connect = () => {
    toast.info("Broker connect", {
      description:
        "Kite/Angel/Dhan/Kotak Neo adapter Phase 3 me aayega — Settings me credentials save karke rahne do.",
    });
  };

  return (
    <div className="space-y-4">
      {/* Red banner */}
      <div className="flex items-center gap-2 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3">
        <ShieldAlert className="h-5 w-5 text-danger" />
        <span className="text-sm font-bold text-danger">
          LIVE MODE — REAL MONEY AT RISK. 2FA confirmation required per order.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Broker connection status */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-foreground">Broker Connection</CardTitle>
              <Badge variant="warning">NOT CONNECTED</Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-text-muted">
                Order routing ke liye broker API key chahiye (Kite ₹2000/mo, Angel/Dhan free).
                Settings page se credentials save karein.
              </p>
              <Button variant="outline" onClick={connect}>
                <Plug className="h-4 w-4" /> Connect Broker
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Safety Gates (armed)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm text-text-muted sm:grid-cols-2">
                <li>✓ Max daily loss limit: ₹5,000</li>
                <li>✓ Max 30 orders/sec (SEBI cap)</li>
                <li>✓ Kill-switch: instant flatten</li>
                <li>✓ 2FA (TOTP) confirm per order</li>
                <li>✓ Position size cap: 5% capital</li>
                <li>✓ Auto square-off: 15:15 IST</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <OrderTicket mode="live" />
      </div>
    </div>
  );
}
