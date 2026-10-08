"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Order ticket: Symbol, Qty, Order type (Market/Limit/SL), Product
   (MIS/NRML/CNC), Buy/Sell, margin preview, confirm modal.
   Shared by /dashboard/paper and /dashboard/live.
--------------------------------------------------------------------------- */

interface OrderTicketProps {
  mode: "paper" | "live";
}

export function OrderTicket({ mode }: OrderTicketProps) {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState("MARKET");
  const [product, setProduct] = useState("MIS");
  const [limitPrice, setLimitPrice] = useState(0);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [confirming, setConfirming] = useState(false);
  const [placing, setPlacing] = useState(false);

  /* Margin preview: CNC 100%, MIS 20% (indicative). */
  const marginPct = product === "CNC" ? 1 : 0.2;
  const margin = qty * (limitPrice || 0) * marginPct;

  const place = async () => {
    setPlacing(true);
    try {
      const res = await apiPost<{ order_id: string; status: string }>(
        "/api/order/place",
        {
          symbol, qty, side, order_type: orderType, product,
          limit_price: limitPrice || null, mode,
        }
      );
      toast.success(`${side} ${qty} ${symbol} placed`, {
        description: `Order ${res.order_id} · ${res.status}`,
      });
      setConfirming(false);
    } catch (e) {
      toast.error("Order rejected", { description: (e as Error).message });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-foreground">Order Ticket</CardTitle>
        <Badge variant={mode === "live" ? "danger" : "default"}>
          {mode.toUpperCase()}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-text-muted">
            Symbol
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="mt-1 font-mono" />
          </label>
          <label className="text-xs text-text-muted">
            Qty
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="mt-1 font-mono" />
          </label>
          <label className="text-xs text-text-muted">
            Order Type
            <Select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="mt-1">
              <option>MARKET</option>
              <option>LIMIT</option>
              <option>SL</option>
            </Select>
          </label>
          <label className="text-xs text-text-muted">
            Product
            <Select value={product} onChange={(e) => setProduct(e.target.value)} className="mt-1">
              <option value="MIS">MIS (Intraday)</option>
              <option value="NRML">NRML (F&O)</option>
              <option value="CNC">CNC (Delivery)</option>
            </Select>
          </label>
          {orderType !== "MARKET" && (
            <label className="col-span-2 text-xs text-text-muted">
              Limit / Trigger Price ₹
              <Input type="number" value={limitPrice} onChange={(e) => setLimitPrice(Number(e.target.value))} className="mt-1 font-mono" />
            </label>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2 text-xs">
          <span className="text-text-muted">Margin required (est.)</span>
          <span className="font-mono font-bold tabular">
            {margin > 0 ? `₹${margin.toLocaleString("en-IN")}` : "— (price needed)"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="success"
            className="h-11 shadow-glow-success"
            onClick={() => { setSide("BUY"); setConfirming(true); }}
          >
            BUY
          </Button>
          <Button
            variant="destructive"
            className="h-11 shadow-glow-danger"
            onClick={() => { setSide("SELL"); setConfirming(true); }}
          >
            SELL
          </Button>
        </div>

        {/* Confirm modal */}
        {confirming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="glass-card w-full max-w-sm p-5">
              <h3 className="text-sm font-bold">
                Confirm {side} order{mode === "live" && " — LIVE MONEY"}
              </h3>
              <dl className="mt-3 space-y-1 font-mono text-xs tabular">
                <ConfirmRow k="Symbol" v={symbol} />
                <ConfirmRow k="Qty" v={String(qty)} />
                <ConfirmRow k="Type" v={`${orderType} · ${product}`} />
                <ConfirmRow k="Mode" v={mode.toUpperCase()} />
              </dl>
              <div className="mt-4 flex gap-2">
                <Button
                  variant={side === "BUY" ? "success" : "destructive"}
                  className={cn("flex-1")}
                  onClick={place}
                  disabled={placing}
                >
                  {placing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm {side}
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={placing}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfirmRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-text-muted">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  );
}
