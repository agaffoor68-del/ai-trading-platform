"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { OAuthWizard, type Cfg } from "@/components/settings/oauth-wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function SettingsPage() {
  const tradingMode = useAppStore((s) => s.tradingMode);
  const [llmKey, setLlmKey] = useState("");
  const [dailyLoss, setDailyLoss] = useState(5000);
  const [posPct, setPosPct] = useState(5);
  const [squareOff, setSquareOff] = useState("15:15");
  const [ips, setIps] = useState("");

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["auth-config"],
    queryFn: () => apiGet<Cfg>("/auth/config-status"),
  });

  const saveKeys = () => {
    if (llmKey.trim()) localStorage.setItem("llm_key_hint", "set");
    toast.success("Saved", {
      description: "LLM key backend .env me LLM_API_KEY likhein phir server restart karein.",
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <SettingsIcon className="h-5 w-5 text-primary" /> Settings
      </h1>
      <OAuthWizard cfg={cfg} loading={isLoading} />
      <Card>
        <CardHeader><CardTitle className="text-foreground">API Keys (Broker + AI)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-text-muted">
            LLM API Key (DeepSeek/OpenAI){" "}
            {cfg?.llm_key ? <Badge variant="success">SET</Badge> : <Badge variant="outline">NOT SET</Badge>}
            <Input type="password" value={llmKey} onChange={(e) => setLlmKey(e.target.value)}
              placeholder="sk-..." className="mt-1 font-mono" />
          </label>
          <label className="text-xs text-text-muted">
            Broker (Kite / Angel / Dhan / Kotak) — Phase 3
            <Input placeholder="API key (Phase 3 me use hoga)" className="mt-1 font-mono" disabled />
          </label>
          <div className="sm:col-span-2"><Button onClick={saveKeys}>Save</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-foreground">Risk Limits</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-text-muted">Max Daily Loss ₹
            <Input type="number" value={dailyLoss} onChange={(e) => setDailyLoss(Number(e.target.value))} className="mt-1 font-mono" />
          </label>
          <label className="text-xs text-text-muted">Position Size % of Capital
            <Input type="number" value={posPct} onChange={(e) => setPosPct(Number(e.target.value))} className="mt-1 font-mono" />
          </label>
          <label className="text-xs text-text-muted">Auto Square-off (IST)
            <Input value={squareOff} onChange={(e) => setSquareOff(e.target.value)} className="mt-1 font-mono" />
          </label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-foreground">Session & Network</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-text-muted">Current mode: <b className="font-mono text-foreground">{tradingMode.toUpperCase()}</b> (topbar se toggle)</p>
          <label className="block text-xs text-text-muted">IP Whitelist (comma-separated, future enforcement)
            <Input value={ips} onChange={(e) => setIps(e.target.value)} placeholder="e.g. 49.37.x.x" className="mt-1 font-mono" />
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
