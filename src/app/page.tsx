"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { MOCK_TENDERS } from "@/lib/mock-data";
import { computeOpportunityScore, detectBlockers, formatCurrency, daysUntil, getUrgencyColor } from "@/lib/scoring";
import { TenderDetail } from "@/components/pipeline/tender-detail";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tender, AICategory } from "@/types/tender";
import { AI_CATEGORIES } from "@/lib/constants";
import {
  Target,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  DollarSign,
  TrendingUp,
  Zap,
  ArrowRight,
  Clock,
  ShieldAlert,
  UserCheck,
  Building2,
  Database,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Defaults — overridden by config fetched at mount
const DEFAULT_MIN_AI_SCORE = 80;
const DEFAULT_MIN_VALUE = 5_000;
const DEFAULT_MAX_VALUE = 2_000_000;

export default function OpportunityInboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("score");
  const [filterCat, setFilterCat] = useState<AICategory | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideBlockers, setHideBlockers] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Scanning config from settings
  const [minAiScore, setMinAiScore] = useState(DEFAULT_MIN_AI_SCORE);
  const [minValue, setMinValue] = useState(DEFAULT_MIN_VALUE);
  const [maxValue, setMaxValue] = useState(DEFAULT_MAX_VALUE);

  useEffect(() => {
    async function loadScanningConfig() {
      try {
        const res = await fetch("/api/config?section=scanning");
        if (res.ok) {
          const json = await res.json();
          const data = json.scanning ?? json;
          if (data.minAiScore) setMinAiScore(data.minAiScore);
          if (data.minContractValue) setMinValue(data.minContractValue);
          if (data.maxContractValue) setMaxValue(data.maxContractValue);
        }
      } catch {
        // Use defaults if config unavailable
      }
    }
    loadScanningConfig();
  }, []);

  // Smart notifications
  const [notifications, setNotifications] = useState<Array<{ text: string; color: string; href: string }>>([]);

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  const fetchTenders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sort: sortBy,
        minScore: String(minAiScore),
        limit: "200",
      });

      const res = await fetch(`/api/tenders?${params}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);

      const json = await res.json();
      const fetched: Tender[] = json.data || [];

      const hydrated = (fetched.length > 0 ? fetched : MOCK_TENDERS).map((t) => ({
        ...t,
        computedScore: computeOpportunityScore(t),
        blockers: detectBlockers(t),
      }));

      setTenders(hydrated);
      setUsingMock(fetched.length === 0);
    } catch {
      const mock = MOCK_TENDERS.map((t) => ({
        ...t,
        computedScore: computeOpportunityScore(t),
        blockers: detectBlockers(t),
      }));
      setTenders(mock);
      setUsingMock(true);
      setError("Using demo data — connect CanadaBuys to load live opportunities");
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, minAiScore]);

  useEffect(() => {
    fetchTenders();
  }, [fetchTenders]);

  // Fetch smart notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      const notifs: Array<{ text: string; color: string; href: string }> = [];
      try {
        const bidRes = await fetch("/api/bid-queue?stats=true");
        if (bidRes.ok) {
          const bidStats = await bidRes.json();
          if (bidStats.awaitingReview > 0) {
            notifs.push({
              text: `${bidStats.awaitingReview} bid${bidStats.awaitingReview > 1 ? "s" : ""} awaiting your review`,
              color: "bg-blue-50 text-blue-700 border-blue-200",
              href: "/bid-queue",
            });
          }
        }
      } catch { /* ignore */ }
      try {
        const contractRes = await fetch("/api/contracts?summary=true");
        if (contractRes.ok) {
          const contractData = await contractRes.json();
          const dueCount = contractData.deliverablesDueThisWeek ?? 0;
          if (dueCount > 0) {
            notifs.push({
              text: `${dueCount} deliverable${dueCount > 1 ? "s" : ""} due this week`,
              color: "bg-amber-50 text-amber-700 border-amber-200",
              href: "/ops",
            });
          }
        }
      } catch { /* ignore */ }
      setNotifications(notifs);
    };
    fetchNotifications();
  }, []);

  const filtered = useMemo(() => {
    let result = tenders.filter((t) => {
      // Primary filter: AI suitability score (raw Claude score, not composite)
      if ((t.aiScore ?? 0) < minAiScore) return false;
      // Value range
      const v = t.estimatedValue ?? 0;
      if (v < minValue || v > maxValue) return false;
      // Only open
      if (t.status === "closed" || t.status === "awarded" || t.status === "cancelled") return false;
      return true;
    });

    if (hideBlockers) {
      result = result.filter((t) => !t.blockers?.some((b) => b.severity === "hard"));
    }

    if (filterCat !== "ALL") {
      result = result.filter((t) => t.aiCategories.includes(filterCat));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q) ||
          t.externalId.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "score":
        result.sort((a, b) => (b.computedScore ?? 0) - (a.computedScore ?? 0));
        break;
      case "value":
        result.sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0));
        break;
      case "deadline":
        result.sort((a, b) => new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime());
        break;
      case "margin":
        result.sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));
        break;
    }

    return result;
  }, [tenders, sortBy, filterCat, searchQuery, hideBlockers, minAiScore, minValue, maxValue]);

  // Add urgent closing notification based on filtered tenders
  useEffect(() => {
    const urgentCount = filtered.filter((t) => daysUntil(t.closingDate) > 0 && daysUntil(t.closingDate) < 3).length;
    if (urgentCount > 0) {
      setNotifications((prev) => {
        // Don't duplicate
        if (prev.some((n) => n.text.includes("closing in"))) return prev;
        return [
          ...prev,
          {
            text: `${urgentCount} opportunit${urgentCount > 1 ? "ies" : "y"} closing in < 48 hours`,
            color: "bg-red-50 text-red-700 border-red-200",
            href: "#",
          },
        ];
      });
    }
  }, [filtered]);

  // Keyboard navigation handler
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && focusedIndex >= 0 && focusedIndex < filtered.length) {
        e.preventDefault();
        const t = filtered[focusedIndex];
        setSelectedId(t.id === selectedId ? null : t.id);
      }
    },
    [filtered, focusedIndex, selectedId]
  );

  const selected = tenders.find((t) => t.id === selectedId) ?? null;

  // Stats for action-focused header
  const clean = filtered.filter((t) => !t.blockers?.some((b) => b.severity === "hard"));
  const totalRevenuePotential = clean.reduce((s, t) => s + (t.estimatedValue ?? 0), 0);
  const avgMargin = clean.length > 0
    ? Math.round(clean.reduce((s, t) => {
        const cr = parseInt(String(t.aiFulfillment?.costReduction ?? "60").replace(/\D/g, "")) || 60;
        return s + cr;
      }, 0) / clean.length)
    : 0;
  const withHardBlocker = filtered.filter((t) => t.blockers?.some((b) => b.severity === "hard")).length;

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-white px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Opportunity Inbox
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              AI-fulfillable contracts · AI score {minAiScore}+ · {formatCurrency(minValue)}–{formatCurrency(maxValue)} · Open now
              {usingMock && " · Demo data"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchTenders}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch("/api/cron/refresh");
                  if (res.ok) {
                    fetchTenders();
                  }
                } catch {
                  // sync failed silently, refresh will show mock data
                  fetchTenders();
                }
              }}
            >
              <Database className="mr-2 h-3.5 w-3.5" />
              Sync CanadaBuys
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="px-8 py-4 border-b border-border bg-muted/30">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Target className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Actionable Now</p>
              <p className="text-lg font-semibold text-foreground">{clean.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="h-4.5 w-4.5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revenue Potential</p>
              <p className="text-lg font-semibold text-foreground">{formatCurrency(totalRevenuePotential)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center">
              <TrendingUp className="h-4.5 w-4.5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg AI Cost Reduction</p>
              <p className="text-lg font-semibold text-foreground">{avgMargin}%</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <ShieldAlert className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Blocked (Hard)</p>
              <p className="text-lg font-semibold text-foreground">{withHardBlocker}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Smart notifications banner */}
      {notifications.length > 0 && (
        <div className="px-8 py-2 border-b border-border bg-white">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {notifications.map((n, i) => (
              <a
                key={i}
                href={n.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors hover:opacity-80 ${n.color}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                {n.text}
                <ArrowRight className="h-3 w-3 opacity-60" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Main split */}
      <div className="flex flex-col lg:flex-row" style={{ height: `calc(100vh - ${notifications.length > 0 ? "17.5rem" : "15rem"})` }}>
        {/* Left list */}
        <div className={`${selected ? "lg:w-[42%]" : "w-full"} border-r border-border overflow-y-auto ${selected ? "hidden lg:block" : ""}`}>
          {/* Filters */}
          <div className="sticky top-0 z-10 border-b border-border bg-white">
            <div className="flex flex-wrap items-center gap-2 px-5 py-3">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Score</SelectItem>
                  <SelectItem value="value">Value</SelectItem>
                  <SelectItem value="deadline">Deadline</SelectItem>
                  <SelectItem value="margin">AI Fit</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                className="h-8 text-sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                Filter
                {showFilters ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">{filtered.length} results</span>
            </div>

            {showFilters && (
              <div className="border-t border-border px-5 py-3 bg-muted/20 flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Category</label>
                  <Select value={filterCat} onValueChange={(v) => setFilterCat(v as AICategory | "ALL")}>
                    <SelectTrigger className="w-[180px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Categories</SelectItem>
                      {(Object.keys(AI_CATEGORIES) as AICategory[]).map((k) => (
                        <SelectItem key={k} value={k}>{AI_CATEGORIES[k].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideBlockers}
                    onChange={(e) => setHideBlockers(e.target.checked)}
                    className="h-3.5 w-3.5 rounded"
                  />
                  Hide hard-blocked
                </label>
                {(filterCat !== "ALL" || hideBlockers || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => { setFilterCat("ALL"); setHideBlockers(false); setSearchQuery(""); }}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Tender cards */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <Inbox className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium mb-1">No actionable opportunities</p>
              <p className="text-xs text-muted-foreground">
                Run a sync to pull live data, or adjust your filters.
              </p>
            </div>
          ) : (
            <ul
              ref={listRef}
              className="divide-y divide-border"
              tabIndex={0}
              onKeyDown={handleListKeyDown}
            >
              {filtered.map((t, idx) => (
                <TenderCard
                  key={t.id}
                  tender={t}
                  isSelected={selectedId === t.id}
                  isFocused={focusedIndex === idx}
                  onSelect={() => setSelectedId(t.id === selectedId ? null : t.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Right: detail */}
        {selected ? (
          <div className="flex-1 overflow-y-auto bg-muted/20">
            <div className="lg:hidden sticky top-0 z-10 bg-white border-b border-border px-4 py-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                ← Back
              </Button>
            </div>
            <TenderDetail tender={selected} />
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center bg-muted/10">
            <div className="text-center text-muted-foreground">
              <Target className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select an opportunity to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tender Card ──────────────────────────────────────────────────────────────

function TenderCard({
  tender,
  isSelected,
  isFocused,
  onSelect,
}: {
  tender: Tender;
  isSelected: boolean;
  isFocused?: boolean;
  onSelect: () => void;
}) {
  const days = daysUntil(tender.closingDate);
  const urgencyColor = getUrgencyColor(days);
  const score = tender.computedScore ?? 0;
  const hardBlockers = tender.blockers?.filter((b) => b.severity === "hard") ?? [];
  const softBlockers = tender.blockers?.filter((b) => b.severity === "soft") ?? [];

  return (
    <li
      className={`px-5 py-4 cursor-pointer transition-colors ${
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : isFocused ? "bg-muted/40 ring-1 ring-inset ring-primary/30" : "hover:bg-muted/30"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title + score */}
          <div className="flex items-start gap-2 mb-1">
            <span className={`shrink-0 text-xs font-bold tabular-nums px-1.5 py-0.5 rounded ${
              score >= 90 ? "bg-emerald-100 text-emerald-700" :
              score >= 80 ? "bg-teal-100 text-teal-700" :
              "bg-amber-100 text-amber-700"
            }`}>{score}</span>
            <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{tender.title}</p>
          </div>

          {/* Dept + ID */}
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{tender.department}</span>
            <span className="text-xs text-muted-foreground/50">·</span>
            <span className="text-xs text-muted-foreground font-mono">{tender.externalId}</span>
          </div>

          {/* Blockers */}
          {hardBlockers.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {hardBlockers.map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5">
                  <ShieldAlert className="h-2.5 w-2.5" />
                  {b.label}
                </span>
              ))}
            </div>
          )}
          {softBlockers.length > 0 && hardBlockers.length === 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {softBlockers.slice(0, 2).map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {b.label}
                </span>
              ))}
            </div>
          )}
          {!hardBlockers.length && !softBlockers.length && (
            <div className="flex items-center gap-1 mb-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-[11px] text-emerald-600 font-medium">No blockers detected</span>
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{formatCurrency(tender.estimatedValue)}</span>
            <span className={`flex items-center gap-1 ${urgencyColor}`}>
              <Clock className="h-3 w-3" />
              {days <= 0 ? "Closed" : days === 1 ? "1 day left" : `${days}d`}
            </span>
            {tender.aiCategories[0] && (
              <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
                {AI_CATEGORIES[tender.aiCategories[0]]?.label ?? tender.aiCategories[0]}
              </span>
            )}
          </div>
        </div>

        {/* CTA arrow */}
        <div className="shrink-0 flex flex-col gap-1.5 items-end pt-0.5">
          {hardBlockers.length === 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2 text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/bid-generator?id=${tender.id}&title=${encodeURIComponent(tender.title)}&dept=${encodeURIComponent(tender.department)}&value=${tender.estimatedValue}`;
              }}
            >
              Bid <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
          {tender.aiFulfillment && hardBlockers.length === 0 && (
            <span className="text-[10px] text-violet-600 font-medium flex items-center gap-0.5">
              <Zap className="h-2.5 w-2.5" />
              {tender.aiFulfillment.costReduction} savings
            </span>
          )}
          {tender.competitorCount <= 5 && (
            <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
              <UserCheck className="h-2.5 w-2.5" />
              Low competition
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
