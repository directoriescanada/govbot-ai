"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ContractOp, FulfillmentJob, AICategory } from "@/types/tender";
import { CATEGORY_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/scoring";

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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Zap,
  Play,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  ArrowRight,
  Edit3,
  Eye,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PassResult {
  passNumber: number;
  passName: string;
  output: string;
  qualityScore: number;
}

interface FulfillOutput {
  deliverable: string;
  format: string;
  estimatedQuality: number;
  humanReviewNotes: string[];
  wordCount: number;
  estimatedAICost: number;
  passes?: PassResult[];
}

interface FulfillResponse {
  job: FulfillmentJob;
  output: FulfillOutput;
}

const AGENT_STEPS = [
  "Initializing agent...",
  "Analyzing requirements...",
  "Generating deliverable...",
  "Finalizing output...",
];

const AI_CATEGORIES = Object.keys(CATEGORY_LABELS) as AICategory[];

// ─── Page Component ──────────────────────────────────────────────────────────

export default function FulfillPage() {
  // ── Contract selection ──
  const [contracts, setContracts] = useState<ContractOp[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>("");

  // ── Form fields ──
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState<AICategory | "">("");
  const [contractValue, setContractValue] = useState<string>("");
  const [brief, setBrief] = useState("");
  const [inputContent, setInputContent] = useState("");

  // ── Agent state ──
  const [isRunning, setIsRunning] = useState(false);
  const [agentStep, setAgentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ── Output state ──
  const [job, setJob] = useState<FulfillmentJob | null>(null);
  const [output, setOutput] = useState<FulfillOutput | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDeliverable, setEditedDeliverable] = useState("");
  const [copied, setCopied] = useState(false);

  // ── Delivered state ──
  const [isDelivering, setIsDelivering] = useState(false);
  const [delivered, setDelivered] = useState(false);

  // ── Contract search ──
  const [contractSearch, setContractSearch] = useState("");

  // ── Human review checklist ──
  const [checkedReviewItems, setCheckedReviewItems] = useState<Record<number, boolean>>({});
  const [skipReview, setSkipReview] = useState(false);

  const stepInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filtered contracts for search
  const filteredContracts = contracts.filter((c) => {
    if (!contractSearch) return true;
    const q = contractSearch.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.department.toLowerCase().includes(q);
  });

  // Review checklist progress
  const reviewNotes = output?.humanReviewNotes ?? [];
  const checkedCount = Object.values(checkedReviewItems).filter(Boolean).length;
  const allReviewChecked = reviewNotes.length === 0 || checkedCount >= reviewNotes.length;
  const canDeliver = skipReview || allReviewChecked;

  // ── Fetch contracts on mount ──
  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((json: { data: ContractOp[] }) => {
        const eligible = (json.data || []).filter(
          (c) => c.status === "active" || c.status === "in_fulfillment"
        );
        setContracts(eligible);
      })
      .catch(() => {
        // Silently fail — user can fill manually
      });
  }, []);

  // ── Auto-fill from selected contract ──
  const handleContractSelect = useCallback(
    (id: string) => {
      setSelectedContractId(id);
      const contract = contracts.find((c) => c.id === id);
      if (contract) {
        setTitle(contract.title);
        setDepartment(contract.department);
        setCategory(contract.category);
        setContractValue(String(contract.contractValue));
        setBrief(contract.deliverableDescription);
        setInputContent("");
      }
    },
    [contracts]
  );

  // ── Animate agent steps ──
  useEffect(() => {
    if (isRunning) {
      setAgentStep(0);
      stepInterval.current = setInterval(() => {
        setAgentStep((prev) => (prev + 1) % AGENT_STEPS.length);
      }, 2500);
    } else {
      if (stepInterval.current) {
        clearInterval(stepInterval.current);
        stepInterval.current = null;
      }
    }
    return () => {
      if (stepInterval.current) clearInterval(stepInterval.current);
    };
  }, [isRunning]);

  // ── Run agent ──
  const handleRun = async () => {
    if (!brief.trim()) return;

    setIsRunning(true);
    setError(null);
    setOutput(null);
    setJob(null);
    setIsEditing(false);
    setDelivered(false);
    setCheckedReviewItems({});
    setSkipReview(false);

    try {
      const res = await fetch("/api/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenderId: selectedContractId || undefined,
          tenderTitle: title,
          department,
          category: category || "WRITING",
          contractValue: contractValue ? Number(contractValue) : undefined,
          brief,
          inputContent,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.error || `Request failed with status ${res.status}`
        );
      }

      const data: FulfillResponse = await res.json();
      setJob(data.job);
      setOutput(data.output);
      setEditedDeliverable(data.output.deliverable);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsRunning(false);
    }
  };

  // ── Copy to clipboard ──
  const handleCopy = async () => {
    const text = isEditing ? editedDeliverable : output?.deliverable || "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Download as DOCX ──
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const handleDownloadDocx = async () => {
    if (!output) return;
    setIsDownloadingDocx(true);
    try {
      const content = isEditing ? editedDeliverable : output.deliverable;
      const res = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "deliverable",
          title: title,
          department: department,
          contractRef: selectedContractId || "DRAFT",
          content,
          isDraft: false,
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GovBot-Deliverable-${title.slice(0, 30).replace(/\s+/g, "-")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("DOCX download error:", err);
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  // ── Mark delivered ──
  const handleDeliver = async () => {
    if (!job) return;
    setIsDelivering(true);

    try {
      // Update the fulfillment job
      await fetch("/api/fulfill", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: job.id, status: "delivered" }),
      });

      // Update the contract if one was selected
      if (selectedContractId) {
        await fetch("/api/contracts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedContractId,
            status: "delivered",
          }),
        });
      }

      setDelivered(true);
    } catch {
      setError("Failed to mark as delivered. Please try again.");
    } finally {
      setIsDelivering(false);
    }
  };

  // ── Quality color ──
  const qualityColor = (score: number) => {
    if (score > 80) return "bg-emerald-100 text-emerald-800";
    if (score >= 60) return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
  };

  const canRun = brief.trim().length > 0 && !isRunning;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Zap className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Fulfillment Studio
            </h1>
            <p className="text-sm text-gray-500">
              Run an AI agent to produce contract deliverables
            </p>
          </div>
        </div>

        {/* Main layout: side-by-side on desktop, stacked on mobile */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left Panel: Configuration (40%) ── */}
          <div className="w-full lg:w-[40%] space-y-5">
            <Card>
              <CardContent className="p-6 space-y-4">
                {/* Contract select with search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Select a contract
                  </label>
                  {contracts.length > 5 && (
                    <Input
                      value={contractSearch}
                      onChange={(e) => setContractSearch(e.target.value)}
                      placeholder="Search contracts..."
                      className="mb-2 h-8 text-sm"
                    />
                  )}
                  <Select
                    value={selectedContractId}
                    onValueChange={handleContractSelect}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose an existing contract..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredContracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title} — {c.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400 mt-1">
                    {filteredContracts.length} contract{filteredContracts.length !== 1 ? "s" : ""} found
                    {contractSearch ? ` for "${contractSearch}"` : ""}. Or fill in manually.
                  </p>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Contract Title
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Translation Services — ESDC"
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Department
                  </label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Employment and Social Development Canada"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Category
                  </label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v as AICategory)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category..." />
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

                {/* Contract Value */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Contract Value (optional)
                  </label>
                  <Input
                    type="number"
                    value={contractValue}
                    onChange={(e) => setContractValue(e.target.value)}
                    placeholder="e.g. 48500"
                  />
                </div>

                {/* Brief */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Brief / Requirements{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Paste the RFP scope, deliverable requirements, or project brief here..."
                    rows={6}
                  />
                </div>

                {/* Source Material */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Source Material (optional)
                  </label>
                  <Textarea
                    value={inputContent}
                    onChange={(e) => setInputContent(e.target.value)}
                    placeholder="For translation, transcription, or document review — paste source content here..."
                    rows={4}
                  />
                </div>

                {/* Estimated time hint */}
                {!isRunning && !output && brief.trim().length > 0 && (
                  <p className="text-xs text-gray-400 text-center">
                    Estimated: ~15s (single pass) · ~45s (4-pass mode)
                  </p>
                )}

                {/* Run button */}
                <Button
                  onClick={handleRun}
                  disabled={!canRun}
                  className="w-full"
                  size="lg"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Running Agent...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run AI Agent
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ── Right Panel: Output (60%) ── */}
          <div className="w-full lg:w-[60%]">
            <Card className="min-h-[600px]">
              <CardContent className="p-6">
                {/* ── State: Running ── */}
                {isRunning && (
                  <div className="flex flex-col items-center justify-center h-[500px] space-y-6">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full bg-violet-100 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 text-violet-600 animate-spin" />
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-lg font-medium text-gray-900">
                        {AGENT_STEPS[agentStep]}
                      </p>
                      <div className="flex items-center gap-1.5 justify-center">
                        {AGENT_STEPS.map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 w-8 rounded-full transition-colors duration-300 ${
                              i <= agentStep
                                ? "bg-violet-500"
                                : "bg-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── State: Error ── */}
                {!isRunning && error && !output && (
                  <div className="flex flex-col items-center justify-center h-[500px] space-y-4">
                    <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="h-7 w-7 text-red-600" />
                    </div>
                    <p className="text-sm text-red-700 text-center max-w-md">
                      {error}
                    </p>
                    <Button variant="outline" onClick={handleRun}>
                      Retry
                    </Button>
                  </div>
                )}

                {/* ── State: Empty ── */}
                {!isRunning && !error && !output && (
                  <div className="flex flex-col items-center justify-center h-[500px] space-y-4 text-center">
                    <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center">
                      <FileText className="h-7 w-7 text-gray-400" />
                    </div>
                    <p className="text-gray-500 max-w-xs">
                      Configure a job and run the agent to generate your
                      deliverable.
                    </p>
                  </div>
                )}

                {/* ── State: Delivered ── */}
                {delivered && (
                  <div className="flex flex-col items-center justify-center h-[500px] space-y-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Deliverable marked as delivered
                    </h2>
                    <a
                      href="/ops"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
                    >
                      Go to Operations
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                )}

                {/* ── State: Output ready ── */}
                {!isRunning && output && !delivered && (
                  <div className="space-y-5">
                    {/* Quality Progression (multi-pass) */}
                    {output.passes && output.passes.length > 1 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                          Quality Progression
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          {output.passes.map((pass, i) => (
                            <div key={pass.passNumber} className="flex items-center gap-2">
                              {i > 0 && <ArrowRight className="h-3 w-3 text-gray-300" />}
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                pass.qualityScore > 80
                                  ? "bg-emerald-100 text-emerald-700"
                                  : pass.qualityScore >= 60
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                              }`}>
                                <span>Pass {pass.passNumber}:</span>
                                <span className="font-bold">
                                  {pass.passNumber === 1 ? "Draft" : pass.qualityScore}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Header row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {output.wordCount.toLocaleString()} words
                      </Badge>
                      <Badge className={qualityColor(output.estimatedQuality)}>
                        Quality: {output.estimatedQuality}/100
                      </Badge>
                      <Badge variant="outline">
                        AI Cost: {formatCurrency(output.estimatedAICost)}
                      </Badge>
                      {output.passes && output.passes.length > 1 && (
                        <Badge variant="outline" className="border-violet-200 text-violet-700">
                          {output.passes.length}-pass
                        </Badge>
                      )}
                      <div className="flex-1" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadDocx}
                        disabled={isDownloadingDocx}
                      >
                        {isDownloadingDocx ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        DOCX
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1.5" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditing(!isEditing);
                          if (!isEditing) {
                            setEditedDeliverable(output.deliverable);
                          }
                        }}
                      >
                        {isEditing ? (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            Preview
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                            Edit Output
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleDeliver}
                        disabled={isDelivering || !canDeliver}
                        title={!canDeliver ? "Complete all review items first" : undefined}
                      >
                        {isDelivering ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Mark Delivered
                      </Button>
                    </div>

                    {/* Inline error */}
                    {error && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    {/* Human review notes */}
                    {output.humanReviewNotes &&
                      output.humanReviewNotes.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-amber-900 mb-2">
                            Human Review Notes
                          </h3>
                          <ul className="space-y-1">
                            {output.humanReviewNotes.map((note, i) => (
                              <li
                                key={i}
                                className="text-sm text-amber-800 flex items-start gap-2"
                              >
                                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                {note}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {/* Human review checklist */}
                    {reviewNotes.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Review Checklist
                          </h3>
                          <span className="text-xs text-gray-500">
                            {checkedCount}/{reviewNotes.length} review items checked
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${reviewNotes.length > 0 ? (checkedCount / reviewNotes.length) * 100 : 0}%` }}
                          />
                        </div>
                        <ul className="space-y-2">
                          {reviewNotes.map((note, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={!!checkedReviewItems[i]}
                                onChange={(e) =>
                                  setCheckedReviewItems((prev) => ({
                                    ...prev,
                                    [i]: e.target.checked,
                                  }))
                                }
                                className="h-4 w-4 rounded border-gray-300 mt-0.5 shrink-0"
                              />
                              <span className={`text-sm ${checkedReviewItems[i] ? "text-gray-400 line-through" : "text-gray-700"}`}>
                                {note}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {!allReviewChecked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3 text-xs text-gray-500"
                            onClick={() => setSkipReview(true)}
                          >
                            Skip Review
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Deliverable content */}
                    {isEditing ? (
                      <Textarea
                        value={editedDeliverable}
                        onChange={(e) => setEditedDeliverable(e.target.value)}
                        className="font-mono text-sm min-h-[400px]"
                        rows={20}
                      />
                    ) : (
                      <div className="border border-gray-200 rounded-lg bg-white p-5 max-h-[600px] overflow-y-auto">
                        <div className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
                          {output.deliverable}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
