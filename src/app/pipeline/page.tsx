"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { MOCK_TENDERS } from "@/lib/mock-data";
import { computeOpportunityScore, formatCurrency, daysUntil, getScoreBg, getUrgencyColor } from "@/lib/scoring";
import { TenderDetail } from "@/components/pipeline/tender-detail";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tender } from "@/types/tender";
import { cn } from "@/lib/utils";
import {
  Inbox,
  Eye,
  Search,
  FileEdit,
  Send,
  Trophy,
  XCircle,
  ArrowRight,
  ChevronDown,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";

const STAGES = [
  { key: "identified", label: "Identified", icon: Eye, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { key: "qualifying", label: "Qualifying", icon: Search, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  { key: "bidding", label: "Bid Writing", icon: FileEdit, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { key: "submitted", label: "Submitted", icon: Send, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { key: "won", label: "Won", icon: Trophy, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { key: "lost", label: "Lost", icon: XCircle, color: "text-red-500 bg-red-50 border-red-200" },
];

type StageKey = "identified" | "qualifying" | "bidding" | "submitted" | "won" | "lost";

interface PipelineTender extends Tender {
  pipelineStage: StageKey;
  stageNotes?: string;
}

function assignDemoStages(tenders: Tender[]): PipelineTender[] {
  const sorted = [...tenders].sort((a, b) => (b.computedScore || 0) - (a.computedScore || 0));
  return sorted.map((t, i): PipelineTender => {
    let stage: StageKey = "identified";
    if (i < 3) stage = "identified";
    else if (i < 5) stage = "qualifying";
    else if (i < 7) stage = "bidding";
    else if (i < 8) stage = "submitted";
    else if (i < 9) stage = "won";
    else stage = "lost";
    return { ...t, pipelineStage: stage };
  });
}

// Modal for creating a contract when a tender is moved to "Won"
function WonContractModal({
  tender,
  onClose,
  onSubmit,
}: {
  tender: PipelineTender;
  onClose: () => void;
  onSubmit: (data: Record<string, string | number>) => void;
}) {
  const [contractValue, setContractValue] = useState(String(tender.estimatedValue || 0));
  const [bidPrice, setBidPrice] = useState(String(Math.round((tender.estimatedValue || 0) * 0.82)));
  const [deliverableDesc, setDeliverableDesc] = useState("");
  const [deliverableDue, setDeliverableDue] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-lg p-6 bg-white shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create Contract from Won Tender</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{tender.title}</p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Contract Value ($)</Label>
              <Input
                type="number"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Our Bid Price ($)</Label>
              <Input
                type="number"
                value={bidPrice}
                onChange={(e) => setBidPrice(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Deliverable Due Date</Label>
            <Input
              type="date"
              value={deliverableDue}
              onChange={(e) => setDeliverableDue(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs">Deliverable Description</Label>
            <Textarea
              rows={3}
              value={deliverableDesc}
              onChange={(e) => setDeliverableDesc(e.target.value)}
              placeholder="What needs to be delivered..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSubmit({
              contractValue: Number(contractValue),
              bidPrice: Number(bidPrice),
              deliverableDue,
              deliverableDesc,
            })}
          >
            <Trophy className="mr-2 h-4 w-4" />
            Create Contract
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Modal for recording loss reason
function LostReasonModal({
  tender,
  onClose,
  onSubmit,
}: {
  tender: PipelineTender;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  const reasons = [
    "Price too high",
    "Competitor had better experience",
    "Didn't meet technical requirements",
    "Incumbency advantage",
    "Missed deadline",
    "Other",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md p-6 bg-white shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Record Loss Reason</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{tender.title}</p>

        <div className="space-y-2 mb-4">
          {reasons.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors",
                reason === r
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-border hover:bg-accent"
              )}
            >
              {r}
            </button>
          ))}
        </div>

        {reason === "Other" && (
          <Textarea
            className="mb-4"
            rows={2}
            placeholder="Describe the reason..."
            onChange={(e) => setReason(e.target.value || "Other")}
          />
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => onSubmit(reason)}
            disabled={!reason}
          >
            Record Loss
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function PipelinePage() {
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pipelineTenders, setPipelineTenders] = useState<PipelineTender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showStageMenu, setShowStageMenu] = useState<string | null>(null);
  const [wonModal, setWonModal] = useState<PipelineTender | null>(null);
  const [lostModal, setLostModal] = useState<PipelineTender | null>(null);

  const loadTenders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/tenders?sort=score&limit=100");
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      const fetched: Tender[] = json.data || [];

      if (fetched.length > 0) {
        setPipelineTenders(assignDemoStages(fetched));
      } else {
        const scored = MOCK_TENDERS.map((t) => ({ ...t, computedScore: computeOpportunityScore(t) }));
        setPipelineTenders(assignDemoStages(scored));
      }
    } catch {
      const scored = MOCK_TENDERS.map((t) => ({ ...t, computedScore: computeOpportunityScore(t) }));
      setPipelineTenders(assignDemoStages(scored));
    } finally {
      setIsLoading(false);
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    loadTenders();
  }, [loadTenders]);

  // Group tenders by stage
  const stagedTenders = useMemo(() => {
    const grouped: Record<StageKey, PipelineTender[]> = {
      identified: [], qualifying: [], bidding: [], submitted: [], won: [], lost: [],
    };
    pipelineTenders.forEach((t) => {
      if (grouped[t.pipelineStage]) {
        grouped[t.pipelineStage].push(t);
      }
    });
    return grouped;
  }, [pipelineTenders]);

  const selected = pipelineTenders.find((t) => t.id === selectedId) || null;
  const totalPipelineValue = pipelineTenders.reduce((s, t) => s + (t.estimatedValue || 0), 0);
  const wonValue = stagedTenders.won.reduce((s, t) => s + (t.estimatedValue || 0), 0);

  // Move a tender to a different stage
  const moveToStage = (tenderId: string, newStage: StageKey) => {
    const tender = pipelineTenders.find((t) => t.id === tenderId);
    if (!tender) return;

    // If moving to "won", show the contract modal
    if (newStage === "won") {
      setWonModal(tender);
      return;
    }

    // If moving to "lost", show the loss reason modal
    if (newStage === "lost") {
      setLostModal(tender);
      return;
    }

    // Direct move for other stages
    setPipelineTenders((prev) =>
      prev.map((t) => (t.id === tenderId ? { ...t, pipelineStage: newStage } : t))
    );
    setShowStageMenu(null);
  };

  // Handle won contract creation
  const handleWonSubmit = async (data: Record<string, string | number>) => {
    if (!wonModal) return;
    try {
      await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenderId: wonModal.id,
          externalId: wonModal.externalId || "",
          title: wonModal.title,
          department: wonModal.department,
          category: wonModal.aiCategories?.[0] || "WRITING",
          contractValue: data.contractValue,
          bidPrice: data.bidPrice,
          wonDate: new Date().toISOString(),
          deliverableDue: data.deliverableDue ? new Date(data.deliverableDue as string).toISOString() : undefined,
          deliverableDescription: data.deliverableDesc,
          status: "active",
        }),
      });
    } catch {
      // Contract creation failed — still move the stage locally
    }

    setPipelineTenders((prev) =>
      prev.map((t) => (t.id === wonModal.id ? { ...t, pipelineStage: "won" as StageKey } : t))
    );
    setWonModal(null);
    setShowStageMenu(null);
  };

  // Handle loss recording
  const handleLostSubmit = async (reason: string) => {
    if (!lostModal) return;
    try {
      await fetch("/api/contracts/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: lostModal.id,
          outcome: "lost",
          notes: reason,
        }),
      });
    } catch {
      // Feedback recording failed — still move stage
    }

    setPipelineTenders((prev) =>
      prev.map((t) => (t.id === lostModal.id ? { ...t, pipelineStage: "lost" as StageKey } : t))
    );
    setLostModal(null);
    setShowStageMenu(null);
  };

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
          <h1 className="text-xl font-semibold text-foreground">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track opportunities from discovery to contract win
          </p>

          {/* Pipeline Summary */}
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Total pipeline:</span>
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Win rate:</span>
              <span className="text-sm font-semibold">
                {stagedTenders.won.length + stagedTenders.lost.length > 0
                  ? Math.round((stagedTenders.won.length / (stagedTenders.won.length + stagedTenders.lost.length)) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Stages */}
        <div className="p-6 space-y-6">
          {STAGES.map((stage) => {
            const stageTenders = stagedTenders[stage.key as StageKey] || [];
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
                            {/* Stage change dropdown */}
                            <div className="relative">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowStageMenu(showStageMenu === tender.id ? null : tender.id);
                                }}
                              >
                                Move
                                <ChevronDown className="ml-1 h-3 w-3" />
                              </Button>
                              {showStageMenu === tender.id && (
                                <div
                                  className="absolute left-0 top-7 z-50 w-40 rounded-lg border border-border bg-white shadow-lg py-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {STAGES.filter((s) => s.key !== tender.pipelineStage).map((s) => {
                                    const SIcon = s.icon;
                                    return (
                                      <button
                                        key={s.key}
                                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                                        onClick={() => moveToStage(tender.id, s.key as StageKey)}
                                      >
                                        <SIcon className="h-3 w-3" />
                                        {s.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {stage.key === "identified" && (
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

      {/* Won Contract Modal */}
      {wonModal && (
        <WonContractModal
          tender={wonModal}
          onClose={() => setWonModal(null)}
          onSubmit={handleWonSubmit}
        />
      )}

      {/* Lost Reason Modal */}
      {lostModal && (
        <LostReasonModal
          tender={lostModal}
          onClose={() => setLostModal(null)}
          onSubmit={handleLostSubmit}
        />
      )}
    </div>
  );
}
