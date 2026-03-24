"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency, daysUntil, getUrgencyColor } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileEdit,
  Download,
  Check,
  X,
  Clock,
  AlertTriangle,
  Loader2,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ---------- Types ---------- */

interface BidQueueItem {
  id: string;
  status: "auto_drafted" | "reviewing" | "approved" | "exported" | "submitted" | "skipped";
  tenderTitle: string;
  department: string;
  estimatedValue: number;
  bidPrice: number;
  marginPercent: number;
  closingDate: string;
  aiScore: number;
  blockers: Array<{ type: string; label: string; severity: string }>;
  bidDraft: Record<string, unknown> | null;
}

interface BidQueueStats {
  total: number;
  awaitingReview: number;
  approved: number;
  totalBidValue: number;
  exported: number;
  submitted: number;
}

/* ---------- Status helpers ---------- */

const STATUS_STYLES: Record<BidQueueItem["status"], string> = {
  auto_drafted: "bg-blue-100 text-blue-700 border-blue-200",
  reviewing: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  exported: "bg-violet-100 text-violet-700 border-violet-200",
  submitted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  skipped: "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_LABELS: Record<BidQueueItem["status"], string> = {
  auto_drafted: "Auto-Drafted",
  reviewing: "Reviewing",
  approved: "Approved",
  exported: "Exported",
  submitted: "Submitted",
  skipped: "Skipped",
};

/* ---------- Component ---------- */

export default function BidQueuePage() {
  const [items, setItems] = useState<BidQueueItem[]>([]);
  const [stats, setStats] = useState<BidQueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Filter tabs
  const [activeTab, setActiveTab] = useState<"all" | BidQueueItem["status"]>("all");

  // Preview expansion
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  /* Fetch data */
  const fetchData = useCallback(async () => {
    try {
      const [statsRes, itemsRes] = await Promise.all([
        fetch("/api/bid-queue?stats=true"),
        fetch("/api/bid-queue"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (itemsRes.ok) setItems(await itemsRes.json());
    } catch (err) {
      console.error("Failed to fetch bid queue", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Filtered items by tab */
  const filteredItems = activeTab === "all"
    ? items
    : items.filter((item) => item.status === activeTab);

  /* Tab counts */
  const tabCounts = {
    all: items.length,
    auto_drafted: items.filter((i) => i.status === "auto_drafted").length,
    reviewing: items.filter((i) => i.status === "reviewing").length,
    approved: items.filter((i) => i.status === "approved").length,
    exported: items.filter((i) => i.status === "exported").length,
    submitted: items.filter((i) => i.status === "submitted").length,
  };

  /* Deadline urgency */
  const getDeadlineBadge = (closingDate: string) => {
    const days = daysUntil(closingDate);
    if (days <= 0) return null;
    if (days < 3)
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 animate-pulse text-[11px] font-bold">
          URGENT
        </Badge>
      );
    if (days <= 7)
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">
          Closing Soon
        </Badge>
      );
    return null;
  };

  /* Bulk actions */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkPatch = async (status: BidQueueItem["status"]) => {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch("/api/bid-queue", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status }),
          })
        )
      );
      setSelectedIds(new Set());
      await fetchData();
    } finally {
      setBulkLoading(false);
    }
  };

  /* Actions */
  const patchStatus = async (id: string, status: BidQueueItem["status"]) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await fetch("/api/bid-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      await fetchData();
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const downloadDocx = async (item: BidQueueItem) => {
    setActionLoading((prev) => ({ ...prev, [item.id]: true }));
    try {
      const res = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bid",
          tenderTitle: item.tenderTitle,
          tenderRef: item.id,
          department: item.department,
          closingDate: item.closingDate,
          ...(item.bidDraft as Record<string, unknown>),
        }),
      });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bid-${item.id}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Mark as exported
      await fetch("/api/bid-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: "exported" }),
      });
      await fetchData();
    } finally {
      setActionLoading((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  /* Render helpers */
  const isItemLoading = (id: string) => !!actionLoading[id];

  const renderActions = (item: BidQueueItem) => {
    const busy = isItemLoading(item.id);

    const previewBtn = (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setPreviewId(previewId === item.id ? null : item.id)}
      >
        {previewId === item.id ? <ChevronUp className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        <span className="ml-1">Preview</span>
      </Button>
    );

    switch (item.status) {
      case "auto_drafted":
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => patchStatus(item.id, "reviewing")}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileEdit className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Review</span>
            </Button>
            {previewBtn}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => patchStatus(item.id, "skipped")}
              disabled={busy}
            >
              <X className="h-3.5 w-3.5" />
              <span className="ml-1">Skip</span>
            </Button>
          </div>
        );

      case "reviewing":
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => patchStatus(item.id, "approved")}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Approve</span>
            </Button>
            {previewBtn}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => patchStatus(item.id, "skipped")}
              disabled={busy}
            >
              <X className="h-3.5 w-3.5" />
              <span className="ml-1">Skip</span>
            </Button>
          </div>
        );

      case "approved":
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => downloadDocx(item)}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Download DOCX</span>
            </Button>
            {previewBtn}
            <Button
              size="sm"
              variant="outline"
              onClick={() => patchStatus(item.id, "submitted")}
              disabled={busy}
            >
              <Check className="h-3.5 w-3.5" />
              <span className="ml-1">Mark Submitted</span>
            </Button>
          </div>
        );

      case "exported":
      case "submitted":
        return (
          <div className="flex items-center gap-2">
            {previewBtn}
            <span className="text-xs text-muted-foreground italic">Read-only</span>
          </div>
        );

      default:
        return null;
    }
  };

  const renderPreview = (item: BidQueueItem) => {
    if (previewId !== item.id) return null;
    if (!item.bidDraft) {
      return (
        <div className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground italic">
          Draft not yet generated
        </div>
      );
    }
    const draft = item.bidDraft as Record<string, unknown>;
    const compliance = draft.complianceMatrix as Array<{ status: string }> | undefined;
    const met = compliance?.filter((c) => c.status === "met").length ?? 0;
    const partial = compliance?.filter((c) => c.status === "partial").length ?? 0;
    const pending = compliance?.filter((c) => c.status === "pending").length ?? 0;
    const sections = draft.proposalSections as Array<{ title: string; content: string }> | undefined;
    const firstSection = sections?.[0];
    const pricingTotal = typeof draft.pricingTotal === "number" ? draft.pricingTotal : null;

    return (
      <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
        {compliance && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Compliance:</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 text-[11px]">{met} met</Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[11px]">{partial} partial</Badge>
            <Badge variant="outline" className="bg-gray-50 text-gray-500 text-[11px]">{pending} pending</Badge>
          </div>
        )}
        {firstSection && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{firstSection.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-3">
              {typeof firstSection.content === "string" ? firstSection.content.slice(0, 200) : ""}
              {typeof firstSection.content === "string" && firstSection.content.length > 200 ? "..." : ""}
            </p>
          </div>
        )}
        {pricingTotal !== null && (
          <p className="text-xs">
            <span className="font-medium text-muted-foreground">Pricing Total:</span>{" "}
            <span className="font-semibold">{formatCurrency(pricingTotal)}</span>
          </p>
        )}
      </div>
    );
  };

  /* ----- Skeleton loader ----- */
  if (loading) {
    return (
      <div className="flex-1 space-y-6 p-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileEdit className="h-6 w-6 text-primary" />
          Bid Queue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Auto-generated bids ready for your review
        </p>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Awaiting Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.awaitingReview}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.approved}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total Bid Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(stats.totalBidValue)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Exported
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.exported}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All", tabCounts.all],
            ["auto_drafted", "Awaiting Review", tabCounts.auto_drafted + (items.filter((i) => i.status === "reviewing").length)],
            ["approved", "Approved", tabCounts.approved],
            ["exported", "Exported", tabCounts.exported],
            ["submitted", "Submitted", tabCounts.submitted],
          ] as const
        ).map(([key, label, count]) => (
          <Button
            key={key}
            variant={activeTab === key ? "default" : "outline"}
            size="sm"
            onClick={() => { setActiveTab(key as typeof activeTab); setSelectedIds(new Set()); }}
            className="text-sm"
          >
            {label} ({count})
          </Button>
        ))}
      </div>

      {/* Queue List */}
      {filteredItems.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No bids in queue. Bids are auto-generated when high-scoring
              tenders (90+) are discovered during data sync.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const days = daysUntil(item.closingDate);
            const urgencyColor = getUrgencyColor(days);
            const deadlineBadge = getDeadlineBadge(item.closingDate);

            return (
              <Card key={item.id}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Bulk checkbox */}
                    <div className="shrink-0 pt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </div>

                    {/* Left: Info */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {deadlineBadge}
                        <Badge
                          variant="outline"
                          className={STATUS_STYLES[item.status]}
                        >
                          {STATUS_LABELS[item.status]}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          AI Score: {item.aiScore}
                        </Badge>
                      </div>

                      <h3 className="truncate text-sm font-semibold leading-snug">
                        {item.tenderTitle}
                      </h3>

                      <p className="text-xs text-muted-foreground">
                        {item.department}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Est. {formatCurrency(item.estimatedValue)} &rarr; Bid{" "}
                          {formatCurrency(item.bidPrice)}
                        </span>
                        <span>Margin {item.marginPercent.toFixed(1)}%</span>
                        <span className={urgencyColor}>
                          <Clock className="mr-1 inline h-3 w-3" />
                          {days <= 0
                            ? "Closed"
                            : `${days}d left`}
                        </span>
                      </div>

                      {/* Blockers */}
                      {item.blockers && item.blockers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {item.blockers.map((b) => (
                            <Badge
                              key={b.label}
                              variant="outline"
                              className="border-red-200 bg-red-50 text-red-600 text-[11px]"
                            >
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              {b.label}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Preview section */}
                      {renderPreview(item)}
                    </div>

                    {/* Right: Actions */}
                    <div className="shrink-0 pt-1">{renderActions(item)}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-lg shadow-xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => bulkPatch("approved")}
            disabled={bulkLoading}
          >
            {bulkLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
            Approve All
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => bulkPatch("skipped")}
            disabled={bulkLoading}
          >
            {bulkLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <X className="h-3.5 w-3.5 mr-1.5" />}
            Skip All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:text-white"
            onClick={() => setSelectedIds(new Set())}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
