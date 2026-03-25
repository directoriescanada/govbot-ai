"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";
import { ContractOp, ContractStatus, AICategory, OpsSummary } from "@/types/tender";
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { formatCurrency, daysUntil } from "@/lib/scoring";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContractsListResponse {
  data: ContractOp[];
  total: number;
}

interface NewContractForm {
  title: string;
  department: string;
  externalId: string;
  category: AICategory | "";
  contractValue: string;
  bidPrice: string;
  wonDate: string;
  deliverableDue: string;
  deliverableDescription: string;
  notes: string;
}

const EMPTY_FORM: NewContractForm = {
  title: "",
  department: "",
  externalId: "",
  category: "",
  contractValue: "",
  bidPrice: "",
  wonDate: "",
  deliverableDue: "",
  deliverableDescription: "",
  notes: "",
};

const AI_CATEGORIES = Object.keys(CATEGORY_LABELS) as AICategory[];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(str: string, len: number): string {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function marginColor(pct: number): string {
  if (pct > 60) return "text-emerald-600";
  if (pct >= 40) return "text-amber-600";
  return "text-red-600";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OpsPage() {
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [contracts, setContracts] = useState<ContractOp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewContractForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "all">("all");

  // ─── Data fetching ───────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, listRes] = await Promise.all([
        fetch("/api/contracts?summary=true"),
        fetch("/api/contracts"),
      ]);

      if (!summaryRes.ok || !listRes.ok) {
        throw new Error("Failed to fetch contracts");
      }

      const summaryData: OpsSummary = await summaryRes.json();
      const listData: ContractsListResponse = await listRes.json();

      setSummary(summaryData);
      setContracts(listData.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Status change ──────────────────────────────────────────────────────

  async function handleStatusChange(id: string, status: ContractStatus) {
    setPatchingId(id);
    try {
      const res = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Status update failed");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPatchingId(null);
    }
  }

  // ─── Create contract ───────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.category || !form.contractValue || !form.bidPrice) return;

    setSubmitting(true);
    try {
      const contractValue = parseFloat(form.contractValue);
      const bidPrice = parseFloat(form.bidPrice);
      const marginPercent =
        contractValue > 0 ? Math.round(((contractValue - bidPrice) / contractValue) * 100) : 0;

      const payload = {
        tenderId: `manual-${Date.now()}`,
        externalId: form.externalId || `MAN-${Date.now().toString(36).toUpperCase()}`,
        title: form.title,
        department: form.department,
        category: form.category,
        contractValue,
        bidPrice,
        wonDate: form.wonDate || new Date().toISOString().split("T")[0],
        startDate: form.wonDate || new Date().toISOString().split("T")[0],
        deliverableDue: form.deliverableDue,
        deliverableDescription: form.deliverableDescription,
        status: "active" as ContractStatus,
        marginPercent,
        aiCostActual: 0,
        notes: form.notes,
      };

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create contract");

      setForm(EMPTY_FORM);
      setShowForm(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────

  if (error && !summary) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => { setLoading(true); setError(null); fetchData(); }}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const upcomingDeadlines = summary?.upcomingDeadlines ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Operations</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Active contracts, deliverables, and revenue tracking
            </p>
          </div>
          <Button
            onClick={() => setShowForm((prev) => !prev)}
            variant={showForm ? "outline" : "default"}
          >
            {showForm ? (
              <>
                <X className="h-4 w-4 mr-1.5" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Mark Contract Won
              </>
            )}
          </Button>
        </div>

        {/* ─── Inline error banner ────────────────────────────────────── */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
            <button className="ml-auto text-red-500 hover:text-red-700" onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ─── Stats Row ──────────────────────────────────────────────── */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Active Contracts
                </CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.activeContracts}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Revenue In-Flight
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.totalContractValue)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Paid
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.totalPaid)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Avg Margin
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${marginColor(summary.avgMarginPercent)}`}>
                  {summary.avgMarginPercent}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── Upcoming Deadlines Banner ─────────────────────────────── */}
        {upcomingDeadlines.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
              <Clock className="h-4 w-4 shrink-0" />
              {upcomingDeadlines.length} deliverable{upcomingDeadlines.length !== 1 ? "s" : ""} due
              within 30 days
            </div>
            <ul className="space-y-1">
              {upcomingDeadlines.map((c) => {
                const days = daysUntil(c.deliverableDue);
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 text-sm text-amber-900 pl-6"
                  >
                    <span className="font-medium truncate max-w-xs">
                      {truncate(c.title, 45)}
                    </span>
                    <span className="text-amber-700">{formatDate(c.deliverableDue)}</span>
                    <Badge variant="outline" className={STATUS_COLORS[c.status]}>
                      {STATUS_LABELS[c.status]}
                    </Badge>
                    {days <= 7 && (
                      <span className="text-red-600 font-semibold text-xs">
                        {days <= 0 ? "OVERDUE" : `${days}d left`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ─── Inline Create Form ────────────────────────────────────── */}
        {showForm && (
          <Card className="border-primary/30 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Mark Contract Won</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Title *</label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Department</label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">External ID</label>
                  <Input
                    value={form.externalId}
                    onChange={(e) => setForm((f) => ({ ...f, externalId: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Category *</label>
                  <Select
                    value={form.category}
                    onValueChange={(val) =>
                      setForm((f) => ({ ...f, category: val as AICategory }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Contract Value *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.contractValue}
                    onChange={(e) => setForm((f) => ({ ...f, contractValue: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Bid Price *</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.bidPrice}
                    onChange={(e) => setForm((f) => ({ ...f, bidPrice: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Won Date</label>
                  <Input
                    type="date"
                    value={form.wonDate}
                    onChange={(e) => setForm((f) => ({ ...f, wonDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Deliverable Due
                  </label>
                  <Input
                    type="date"
                    value={form.deliverableDue}
                    onChange={(e) => setForm((f) => ({ ...f, deliverableDue: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Deliverable Description
                  </label>
                  <Textarea
                    rows={2}
                    value={form.deliverableDescription}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, deliverableDescription: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                  <Textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowForm(false);
                      setForm(EMPTY_FORM);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Save Contract"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ─── Search / Filter ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search by title or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as ContractStatus | "all")}
          >
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="in_fulfillment">In Fulfillment</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="invoiced">Invoiced</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ─── Contracts Table ────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5">
                      Title
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 hidden lg:table-cell">
                      Department
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 hidden md:table-cell">
                      Category
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2.5">
                      Value
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2.5 hidden sm:table-cell">
                      Bid
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2.5">
                      Margin
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 hidden md:table-cell">
                      Due
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5">
                      Status
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2.5">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-muted-foreground">
                        No contracts yet. Click &quot;Mark Contract Won&quot; to add one.
                      </td>
                    </tr>
                  ) : (
                    contracts
                    .filter((c) => {
                      const q = searchQuery.toLowerCase();
                      const matchesSearch = !q || c.title.toLowerCase().includes(q) || c.department.toLowerCase().includes(q);
                      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
                      return matchesSearch && matchesStatus;
                    })
                    .map((c) => {
                      const days = daysUntil(c.deliverableDue);
                      const dueDateClass = days >= 0 && days < 14 ? "text-red-600 font-medium" : "";
                      const isPatching = patchingId === c.id;

                      return (
                        <React.Fragment key={c.id}>
                        <tr
                          className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${editingNotesId === c.id ? "border-b-0" : ""}`}
                        >
                          <td className="px-3 py-2.5 max-w-[200px]">
                            <span className="font-medium" title={c.title}>
                              {truncate(c.title, 50)}
                            </span>
                          </td>
                          <td
                            className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell max-w-[160px]"
                            title={c.department}
                          >
                            {truncate(c.department, 30)}
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell">
                            <Badge variant="secondary" className="text-xs font-normal">
                              {CATEGORY_LABELS[c.category] ?? c.category}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {formatCurrency(c.contractValue)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell">
                            {formatCurrency(c.bidPrice)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right tabular-nums font-medium ${marginColor(c.marginPercent)}`}
                          >
                            {c.marginPercent}%
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell whitespace-nowrap">
                            {formatDate(c.deliverableDue)}
                            {c.deliverableDue && days < 0 && (
                              <Badge className="ml-1.5 text-[10px] bg-red-100 text-red-700 border-red-300">OVERDUE</Badge>
                            )}
                            {c.deliverableDue && days >= 0 && days < 7 && (
                              <Badge className="ml-1.5 text-[10px] bg-red-100 text-red-700 border-red-300">{days}d left</Badge>
                            )}
                            {c.deliverableDue && days >= 7 && days <= 14 && (
                              <Badge className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 border-amber-300">{days}d left</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[c.status]}`}>
                              {STATUS_LABELS[c.status]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={isPatching}
                                >
                                  {isPatching ? "..." : "Actions"}
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                {c.status === "active" && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(c.id, "in_fulfillment")}
                                  >
                                    Start Fulfillment
                                  </DropdownMenuItem>
                                )}
                                {(c.status === "active" || c.status === "in_fulfillment") && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(c.id, "delivered")}
                                  >
                                    Mark Delivered
                                  </DropdownMenuItem>
                                )}
                                {c.status === "delivered" && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(c.id, "invoiced")}
                                  >
                                    Mark Invoiced
                                  </DropdownMenuItem>
                                )}
                                {c.status === "invoiced" && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(c.id, "paid")}
                                  >
                                    Mark Paid
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingNotesId(c.id);
                                    setEditingNotesText("");
                                  }}
                                >
                                  Add Notes
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                        {editingNotesId === c.id && (
                          <tr className="border-b bg-muted/10">
                            <td colSpan={9} className="px-3 py-3">
                              <div className="flex gap-2 items-start">
                                <Textarea
                                  className="flex-1 text-sm min-h-[60px]"
                                  rows={2}
                                  placeholder="Add notes..."
                                  value={editingNotesText}
                                  onChange={(e) => setEditingNotesText(e.target.value)}
                                  autoFocus
                                />
                                <div className="flex flex-col gap-1.5">
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={!editingNotesText.trim()}
                                    onClick={async () => {
                                      try {
                                        await fetch("/api/contracts", {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            id: c.id,
                                            notes: c.notes ? c.notes + "\n" + editingNotesText : editingNotesText,
                                          }),
                                        });
                                        setEditingNotesId(null);
                                        setEditingNotesText("");
                                        await fetchData();
                                      } catch (err) {
                                        setError(err instanceof Error ? err.message : "Failed to save notes");
                                      }
                                    }}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => { setEditingNotesId(null); setEditingNotesText(""); }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                              {c.notes && (
                                <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{c.notes}</p>
                              )}
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
