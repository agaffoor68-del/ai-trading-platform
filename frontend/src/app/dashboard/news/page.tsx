"use client";

import { useQuery } from "@tanstack/react-query";
import { Newspaper, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Skeleton } from "@/components/ui/badge";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";

/* News + sentiment feed (spec route /dashboard/news). */

interface NewsItem {
  title: string; link: string; published: string;
  snippet: string; sentiment: number;
}

export default function NewsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["news"],
    queryFn: () => apiGet<{ items: NewsItem[]; avg_sentiment: number; mood: string }>("/api/news"),
    refetchInterval: 10 * 60 * 1000,
  });

  const mood = data?.mood ?? "Neutral";
  const avg = data?.avg_sentiment ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Newspaper className="h-5 w-5 text-primary" /> Market News
        </h1>
        <Badge variant={mood === "Bullish" ? "success" : mood === "Bearish" ? "danger" : "warning"}>
          Mood: {mood} ({avg >= 0 ? "+" : ""}{avg})
        </Badge>
      </div>
      {isLoading ? <Skeleton className="h-64 w-full" /> : !data?.items.length ? (
        <Card><CardContent className="py-10 text-center text-sm text-text-muted">
          Feed unavailable — thodi der me retry karein.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.items.map((n, i) => (
            <Card key={i}>
              <CardHeader className="flex-row items-start justify-between gap-2">
                <CardTitle className="text-sm font-semibold leading-snug text-foreground">
                  {n.title}
                </CardTitle>
                <span className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-bold",
                  n.sentiment > 0 ? "bg-success/15 text-success"
                  : n.sentiment < 0 ? "bg-danger/15 text-danger"
                  : "bg-border/40 text-text-muted"
                )}>
                  {n.sentiment >= 0 ? "+" : ""}{n.sentiment.toFixed(2)}
                </span>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="line-clamp-2 text-xs text-text-muted">{n.snippet}</p>
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>{n.published}</span>
                  <a href={n.link} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 text-primary hover:underline">
                    Read <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
