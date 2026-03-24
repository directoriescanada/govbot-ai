"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { MOCK_TENDERS } from "@/lib/mock-data";
import { computeOpportunityScore, formatCurrency, daysUntil, getScoreBg, getUrgencyColor } from "@/lib/scoring";
import { TenderDetail } from "@/components/pipeline/tender-detail";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tender } from "@/types/tender";
import { cn } from "@/lib/utils";
import {
  Inbox,
  Eye,
  FileEdit,
  Send,
  Trophy,
  XCircle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const STAGES = [
  { key: "reviewing", label: "Reviewing", icon: Eye, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { key: "bidding", label: "Writing Bid", icon: FileEdit, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { key: "submitted", label: "Submitted", icon: Send, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { key: "won", label: "Won", icon: Trophy, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { key: "lost", label: "Lost", icon: XCircle, color: "text-red-500 bg-red-50 border-red-200" },
];

function assignDemoStages(tenders: Tender[]) {
  const sorted = [...tenders].sort((a, b) => (b.computedScore || 0) - (a.computedScore || 0));
  const staged: Record<string, Tender[]> = {
    reviewing: [],
    bidding: [],
    submitted: [],
    won: [],
    lost: [],
  };

  sorted.forEach((t, i) => {
    if (i < 3) staged.reviewing.push(t);
    else if (i < 5) staged.bidding.push(t);
    else if (i < 7) staged.submitted.push(t);
    else if (i < 9) staged.won.push(t);
    else staged.lost.push(t);
  });

  return staged;
}

export default function PipelinePage() {
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTenders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/tenders?sort=score&limit=100");
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      const fetched: Tender[] = json.data || [];

      if (fetched.length > 0) {
        setTenders(fetched);
      } else {
        setTenders(
          MOCK_TENDERS.map((t) => ({ ...t, computedScore: computeOpportunityScore(t) }))
        );
      }
    } catch {
      setTenders(
        MOCK_TENDERS.map((t) => ({ ...t, computedScore: computeOpportunityScore(t) }))
      );
    } finally {
      setIsLoading(false);
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    loadTenders();
  }, [loadTenders]);

  const stagedTenders = useMemo(() => assignDemoStages(tenders), [tenders]);
  const selected = tenders.find((t) => t.id === selectedId) || null;

  const totalPipelineValue = tenders.reduce((s, t) => s + (t.estimatedValue || 0), 0);
  const wonValue = stagedTenders.won.reduce((s, t) => s + (t.estimatedValue || 0), 0);

  if (!mounted || isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-4 w-72 mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row" style={{ height: "100vh" }}>
      {/* Left: Pipeline Board */}
      <div
        className={cn(
          "overflow-y-auto transition-all",
          selected ? "lg:w-[50%] w-full hidden lg:block" : "w-full"
        )}
      >
        {/* Header */}
        <div className="border-b border-border bg-white px-8 py-6">
          <h1 className="text-xl font-semibold text-foreground">My Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track opportunities from discovery to contract win
          </p>

          {/* Pipeline Summary */}
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Total:</span>
              <span className="text-sm font-semibold">{formatCurrency(totalPipelineValue)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Won:</span>
              <span className="text-sm font-semibold text-emerald-600">{formatCurrency(wonValue)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Active bids:</span>
              <span className="text-sm font-semibold">{stagedTenders.bidding.length + stagedTenders.submitted.length}</span>
            </div>
          </div>
        </div>

        {/* Stages */}
        <div className="p-6 space-y-6">
          {STAGES.map((stage) => {
            const stageTenders = stagedTenders[stage.key] || [];
            const Icon = stage.icon;

            return (
              <div key={stage.key}>
                {/* Stage Header */}
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className={cn("text-xs font-medium", stage.color)}>
                    <Icon className="mr-1 h-3 w-3" />
                    {stage.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {stageTenders.length} {stageTenders.length === 1 ? "opportunity" : "opportunities"}
                    {stageTenders.length > 0 && (
                      <span className="ml-1">
                        ({formatCurrency(stageTenders.reduce((s, t) => s + (t.estimatedValue || 0), 0))})
                      </span>
                    )}
                  </span>
                </div>

                {/* Tender Cards */}
                {stageTenders.length === 0 ? (
                  <Card className="p-4 bg-muted/20 border-dashed">
                    <p className="text-xs text-muted-foreground text-center">
                      No opportunities in this stage
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {stageTenders.map((tender) => {
                      const days = daysUntil(tender.closingDate);
                      const score = tender.computedScore || 0;
                      const isSelected = selectedId === tender.id;

                      return (
                        <Card
                          key={tender.id}
                          className={cn(
                            "p-4 cursor-pointer transition-all hover:shadow-md",
                            isSelected && "ring-2 ring-primary/30 shadow-md"
                          )}
                          onClick={() => setSelectedId(isSelected ? null : tender.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug mb-1">
                                {tender.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {tender.department}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={cn(
                                "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold",
                                getScoreBg(score)
                              )}>
                                {score}
                              </span>
                              <span className="text-xs font-medium">
                                {formatCurrency(tender.estimatedValue)}
                              </span>
                              <span className={cn("text-[10px] font-medium", getUrgencyColor(days))}>
                                {days}d left
                              </span>
                            </div>
                          </div>

                          {/* Quick actions */}
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/60">
                            {stage.key === "reviewing" && (
                              <Button size="sm" className="h-6 text-[11px] px-2.5" asChild>
                                <Link href={`/bid-generator?tender=${tender.id}&title=${encodeURIComponent(tender.title)}&dept=${encodeURIComponent(tender.department)}&desc=${encodeURIComponent((tender.description || "").slice(0, 500))}&value=${tender.estimatedValue}`}>
                                  <FileEdit className="mr-1 h-3 w-3" />
                                  Start Bid
                                </Link>
                              </Button>
                            )}
                            {stage.key === "bidding" && (
                              <Button size="sm" variant="outline" className="h-6 text-[11px] px-2.5" asChild>
                                <Link href={`/bid-generator?tender=${tender.id}&title=${encodeURIComponent(tender.title)}&dept=${encodeURIComponent(tender.department)}&desc=${encodeURIComponent((tender.description || "").slice(0, 500))}&value=${tender.estimatedValue}`}>
                                  <FileEdit className="mr-1 h-3 w-3" />
                                  Continue Bid
                                </Link>
                              </Button>
                            )}
                            {stage.key === "won" && (
                              <span className="text-[11px] text-emerald-600 font-medium">Contract awarded</span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px] px-2 ml-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(tender.id);
                              }}
                            >
                              Details
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Detail Panel */}
      {selected ? (
        <div className="flex-1 overflow-y-auto bg-muted/20 border-l border-border">
          <div className="lg:hidden sticky top-0 z-10 bg-white border-b border-border px-4 py-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
              ← Back to pipeline
            </Button>
          </div>
          <TenderDetail tender={selected as Tender} />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center text-muted-foreground bg-muted/20 border-l border-border">
          <div className="text-center">
            <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm">Click any opportunity to see details</p>
          </div>
        </div>
      )}
    </div>
  );
}
