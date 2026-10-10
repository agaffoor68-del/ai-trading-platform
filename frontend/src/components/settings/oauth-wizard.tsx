"use client";

import { Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Skeleton } from "@/components/ui/badge";

export interface Cfg {
  google_oauth: boolean;
  authlib_installed: boolean;
  llm_key: boolean;
  hint: string;
}

/* Google OAuth setup wizard card. */
export function OAuthWizard({ cfg, loading }: { cfg?: Cfg; loading: boolean }) {
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success("Copied");
  };
  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-foreground">Google Login — Setup Wizard</CardTitle>
        {loading ? <Skeleton className="h-5 w-24" /> : (
          <Badge variant={cfg?.google_oauth ? "success" : "warning"}>
            {cfg?.google_oauth ? "CONFIGURED" : "NOT CONFIGURED"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ol className="list-decimal space-y-1.5 pl-5 text-text-muted">
          <li>Google Cloud Console → <b className="text-foreground">APIs & Services → Credentials</b></li>
          <li><b className="text-foreground">Create Credentials → OAuth client ID → Web application</b></li>
          <li>Redirect URI add karein:
            <button
              onClick={() => copy("https://ai-trading-platform-38xs.onrender.com/auth/google/callback")}
              className="ml-2 inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 font-mono text-xs text-primary hover:bg-white/5"
            >
              https://ai-trading-platform-38xs.onrender.com/auth/google/callback <Copy className="h-3 w-3" />
            </button>
          </li>
          <li>Client ID + Secret copy karke backend <b className="font-mono text-foreground">.env</b> me:
            <pre className="mt-1 overflow-x-auto rounded bg-background p-2 font-mono text-xs">
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com{"\n"}GOOGLE_CLIENT_SECRET=xxxx</pre>
          </li>
          <li>Backend restart → /login pe <b className="text-foreground">Google button</b> live.</li>
        </ol>
        {!loading && !cfg?.authlib_installed && (
          <p className="flex items-center gap-2 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> authlib missing — backend me `pip install authlib` chalao.
          </p>
        )}
        {cfg?.google_oauth && (
          <p className="flex items-center gap-2 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> OAuth configured — Google login ready.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
