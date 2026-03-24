"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { MOCK_TENDERS } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/scoring";
import {
  FileEdit,
  Upload,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  DollarSign,
  Loader2,
  Download,
  Pencil,
  Save,
} from "lucide-react";

interface PricingRecommendation {
  recommendedBidPrice: number;
  bidAsPercentOfEstimate: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  historicalRange: { low: number; high: number };
  sampleSize: number;
  competitionLevel: "low" | "medium" | "high";
}

interface GeneratedBid {
  complianceMatrix: Array<{
    requirement: string;
    section: string;
    mandatory: boolean;
    response: string;
    status: string;
  }>;
  proposalSections: Array<{
    title: string;
    content: string;
    wordCount: number;
  }>;
  pricingModel: {
    totalBidPrice: number;
    aiCosts: number;
    humanCosts: number;
    infrastructure: number;
    overhead: number;
    margin: number;
    marginPercent: number;
  };
  pricingRecommendation?: PricingRecommendation;
}

function BidGeneratorContent() {
  const searchParams = useSearchParams();
  const tenderId = searchParams.get("tender");
  const prefillTender = MOCK_TENDERS.find((t) => t.id === tenderId);

  const urlTitle = searchParams.get("title") || "";
  const urlDept = searchParams.get("dept") || "";
  const urlDesc = searchParams.get("desc") || "";
  const urlValue = searchParams.get("value") || "";

  const [title, setTitle] = useState(prefillTender?.title || urlTitle);
  const [description, setDescription] = useState(prefillTender?.description || urlDesc);
  const [department, setDepartment] = useState(prefillTender?.department || urlDept);
  const [requirements, setRequirements] = useState("");
  const [estimatedValue, setEstimatedValue] = useState(
    prefillTender?.estimatedValue?.toString() || urlValue
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBid, setGeneratedBid] = useState<GeneratedBid | null>(null);
  const [activeTab, setActiveTab] = useState("input");
  const [isEditingProposal, setIsEditingProposal] = useState(false);
  const [editedSections, setEditedSections] = useState<Record<number, string>>({});
  const [draftBanner, setDraftBanner] = useState<{ title: string; department: string; estimatedValue: string; generatedBid: GeneratedBid; timestamp: number } | null>(null);

  // D. Restore draft from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("govbot-bid-draft");
      if (raw) {
        const parsed = JSON.parse(raw);
        const age = Date.now() - (parsed.timestamp || 0);
        if (age < 24 * 60 * 60 * 1000) {
          setDraftBanner(parsed);
        } else {
          localStorage.removeItem("govbot-bid-draft");
        }
      }
    } catch { /* ignore */ }
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/bid-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          department,
          requirements,
          estimatedValue: parseFloat(estimatedValue) || 100000,
        }),
      });

      if (!res.ok) throw new Error("Generation failed");

      const data = await res.json();
      setGeneratedBid(data);
      setActiveTab("compliance");
      try { localStorage.setItem("govbot-bid-draft", JSON.stringify({ title, department, estimatedValue, generatedBid: data, timestamp: Date.now() })); } catch { /* ignore */ }
    } catch (err) {
      console.error("Bid generation error:", err);
      // Generate mock data for demo mode
      const mockBid = generateMockBid(title, description, parseFloat(estimatedValue) || 100000);
      setGeneratedBid(mockBid);
      setActiveTab("compliance");
      try { localStorage.setItem("govbot-bid-draft", JSON.stringify({ title, department, estimatedValue, generatedBid: mockBid, timestamp: Date.now() })); } catch { /* ignore */ }
    } finally {
      setIsGenerating(false);
    }
  };

  const cameFromQuickBid = !!tenderId || !!urlTitle;
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadDocx = async () => {
    if (!generatedBid) return;
    setIsDownloading(true);
    try {
      const res = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bid",
          tenderTitle: title,
          tenderRef: tenderId || "DRAFT",
          department,
          closingDate: new Date().toISOString(),
          complianceMatrix: generatedBid.complianceMatrix,
          proposalSections: generatedBid.proposalSections.map((s, i) => editedSections[i] !== undefined ? { ...s, content: editedSections[i] } : s),
          pricingModel: generatedBid.pricingModel,
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GovBot-Bid-${tenderId || "draft"}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("DOCX download error:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8">
        {cameFromQuickBid && (
          <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-xs" asChild>
            <Link href="/">← Back to opportunities</Link>
          </Button>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Generate Bid Response</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {cameFromQuickBid
                ? "We've pre-filled the details from the opportunity. Review, add any extra requirements, and hit Generate."
                : "Paste an RFP or tender details and let AI generate a complete bid — compliance matrix, proposal, and pricing."}
            </p>
          </div>
          {generatedBid && (
            <Button onClick={handleDownloadDocx} disabled={isDownloading} className="shrink-0">
              {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download DOCX
            </Button>
          )}
        </div>
      </div>

      {/* D. Restore draft banner */}
      {draftBanner && !generatedBid && (
        <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-blue-800">
            Restore previous draft for &ldquo;{draftBanner.title}&rdquo;?
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTitle(draftBanner.title);
                setDepartment(draftBanner.department);
                setEstimatedValue(draftBanner.estimatedValue);
                setGeneratedBid(draftBanner.generatedBid);
                setActiveTab("compliance");
                setDraftBanner(null);
              }}
            >
              Restore
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setDraftBanner(null); localStorage.removeItem("govbot-bid-draft"); }}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-muted/50">
          <TabsTrigger value="input">
            <Upload className="mr-2 h-4 w-4" />
            Input
          </TabsTrigger>
          <TabsTrigger value="compliance" disabled={!generatedBid}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Compliance Matrix
          </TabsTrigger>
          <TabsTrigger value="proposal" disabled={!generatedBid}>
            <FileText className="mr-2 h-4 w-4" />
            Proposal
          </TabsTrigger>
          <TabsTrigger value="pricing" disabled={!generatedBid}>
            <DollarSign className="mr-2 h-4 w-4" />
            Pricing
          </TabsTrigger>
        </TabsList>

        {/* Input Tab */}
        <TabsContent value="input">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Tender / RFP Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Data Analytics Services — Statistics Canada"
                  className="mt-1.5 bg-muted/50 border-border"
                />
              </div>
              <div>
                <Label htmlFor="department">Department / Client</Label>
                <Input
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g., Statistics Canada"
                  className="mt-1.5 bg-muted/50 border-border"
                />
              </div>
              <div>
                <Label htmlFor="value">Estimated Value (CAD)</Label>
                <Input
                  id="value"
                  type="number"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  placeholder="e.g., 250000"
                  className="mt-1.5 bg-muted/50 border-border"
                />
              </div>
              <div>
                <Label htmlFor="description">Description / Scope of Work</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Paste the full tender description or scope of work here..."
                  rows={8}
                  className="mt-1.5 bg-muted/50 border-border"
                />
              </div>
              <div>
                <Label htmlFor="requirements">
                  Additional Requirements (optional)
                </Label>
                <Textarea
                  id="requirements"
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Paste any specific requirements, evaluation criteria, or mandatory conditions..."
                  rows={4}
                  className="mt-1.5 bg-muted/50 border-border"
                />
              </div>
            </div>

            <div className="space-y-4">
              {/* Upload zone placeholder */}
              <Card className="border-dashed border-2 border-border bg-muted/10 p-8 text-center">
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-semibold mb-1">
                  Upload RFP Document
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  PDF, DOCX, or TXT — we&apos;ll extract the details automatically
                </p>
                <Button variant="outline" size="sm" disabled>
                  Coming Soon
                </Button>
              </Card>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !title || !description}
                className="w-full h-12 text-base font-bold"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Bid Response...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-5 w-5" />
                    Generate Bid Response
                  </>
                )}
              </Button>

              {isGenerating && (
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-primary font-semibold">
                        AI is analyzing the tender...
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <Step label="Extracting requirements" done />
                      <Step label="Building compliance matrix" done={false} />
                      <Step label="Drafting proposal sections" done={false} />
                      <Step label="Calculating pricing model" done={false} />
                    </div>
                  </div>
                </Card>
              )}

              {/* Quick Tips */}
              <Card className="p-4 bg-white shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Tips for Best Results
                </h3>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <FileEdit className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
                    Include the full description — more detail = better proposal
                  </li>
                  <li className="flex items-start gap-2">
                    <FileEdit className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
                    Add evaluation criteria to the requirements field
                  </li>
                  <li className="flex items-start gap-2">
                    <FileEdit className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
                    Set accurate estimated value for realistic pricing
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Compliance Matrix Tab */}
        <TabsContent value="compliance">
          {generatedBid && (
            <div className="space-y-4">
              {/* C. Compliance risk indicator */}
              {(() => {
                const unresolvedMandatory = generatedBid.complianceMatrix.filter(
                  (c) => c.mandatory && c.status !== "met"
                ).length;
                if (unresolvedMandatory > 0) {
                  return (
                    <div className={`rounded-md border px-4 py-3 flex items-center gap-2 text-sm font-medium ${unresolvedMandatory >= 3 ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {unresolvedMandatory} mandatory requirement{unresolvedMandatory !== 1 ? "s" : ""} unresolved — review before submitting
                    </div>
                  );
                }
                return null;
              })()}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {generatedBid.complianceMatrix.length} requirements extracted
                </p>
                <div className="flex gap-2">
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-500/20">
                    {generatedBid.complianceMatrix.filter((c) => c.status === "met").length} Met
                  </Badge>
                  <Badge className="bg-amber-50 text-amber-600 border-amber-500/20">
                    {generatedBid.complianceMatrix.filter((c) => c.status === "partial").length} Partial
                  </Badge>
                  <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                    {generatedBid.complianceMatrix.filter((c) => c.status === "pending").length} Pending
                  </Badge>
                </div>
              </div>
              {generatedBid.complianceMatrix.map((item, i) => (
                <Card key={i} className="p-4 bg-white shadow-sm">
                  <div className="flex items-start gap-3">
                    {item.status === "met" && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    )}
                    {item.status === "partial" && (
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    )}
                    {item.status === "pending" && (
                      <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">
                          {item.requirement}
                        </p>
                        {item.mandatory && (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20">
                            Mandatory
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Section: {item.section}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {item.response}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Proposal Tab */}
        <TabsContent value="proposal">
          {generatedBid && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingProposal((prev) => !prev)}
                >
                  {isEditingProposal ? (
                    <><Save className="mr-2 h-4 w-4" />Done Editing</>
                  ) : (
                    <><Pencil className="mr-2 h-4 w-4" />Edit Sections</>
                  )}
                </Button>
              </div>
              {generatedBid.proposalSections.map((section, i) => (
                <Card key={i} className="p-6 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold">{section.title}</h3>
                    <Badge variant="outline" className="text-[10px]">
                      ~{section.wordCount} words
                    </Badge>
                  </div>
                  <Separator className="mb-4" />
                  {isEditingProposal ? (
                    <Textarea
                      className="text-sm text-muted-foreground leading-relaxed min-h-[120px]"
                      value={editedSections[i] !== undefined ? editedSections[i] : section.content}
                      onChange={(e) =>
                        setEditedSections((prev) => ({ ...prev, [i]: e.target.value }))
                      }
                      rows={8}
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {editedSections[i] !== undefined ? editedSections[i] : section.content}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          {generatedBid && (
            <div className="space-y-6">
              {/* A. Pricing recommendation banner */}
              {generatedBid.pricingRecommendation && (
                <Card className="p-4 bg-blue-50 border-blue-200 shadow-sm">
                  <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">
                        Based on {generatedBid.pricingRecommendation.sampleSize} similar awards, recommended bid:{" "}
                        <span className="font-mono">{formatCurrency(generatedBid.pricingRecommendation.recommendedBidPrice)}</span>{" "}
                        ({generatedBid.pricingRecommendation.bidAsPercentOfEstimate}% of estimate) — Confidence:{" "}
                        <Badge variant="outline" className={`text-[10px] ml-1 ${
                          generatedBid.pricingRecommendation.confidence === "high"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : generatedBid.pricingRecommendation.confidence === "medium"
                              ? "bg-amber-50 text-amber-700 border-amber-300"
                              : "bg-red-50 text-red-700 border-red-300"
                        }`}>
                          {generatedBid.pricingRecommendation.confidence.charAt(0).toUpperCase() + generatedBid.pricingRecommendation.confidence.slice(1)}
                        </Badge>
                      </p>
                      <p className="text-xs text-blue-700 mt-1">{generatedBid.pricingRecommendation.reasoning}</p>
                      <p className="text-xs text-blue-600 mt-1">
                        Historical range: {formatCurrency(generatedBid.pricingRecommendation.historicalRange.low)} – {formatCurrency(generatedBid.pricingRecommendation.historicalRange.high)}
                      </p>
                    </div>
                  </div>
                </Card>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-4 bg-white shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Total Bid Price
                  </p>
                  <p className="text-xl font-extrabold font-mono">
                    {formatCurrency(generatedBid.pricingModel.totalBidPrice)}
                  </p>
                </Card>
                <Card className="p-4 bg-white shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Estimated Cost
                  </p>
                  <p className="text-xl font-extrabold font-mono text-red-500">
                    {formatCurrency(
                      generatedBid.pricingModel.aiCosts +
                        generatedBid.pricingModel.humanCosts +
                        generatedBid.pricingModel.infrastructure +
                        generatedBid.pricingModel.overhead
                    )}
                  </p>
                </Card>
                <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Gross Margin
                  </p>
                  <p className="text-xl font-extrabold font-mono text-emerald-600">
                    {formatCurrency(generatedBid.pricingModel.margin)}
                  </p>
                </Card>
                <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Margin %
                  </p>
                  <p className="text-xl font-extrabold font-mono text-emerald-600">
                    {generatedBid.pricingModel.marginPercent}%
                  </p>
                </Card>
              </div>

              <Card className="p-6 bg-white shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                  Cost Breakdown
                </h3>
                <div className="space-y-4">
                  <CostLine
                    label="AI API Costs (Claude, tools)"
                    value={generatedBid.pricingModel.aiCosts}
                    total={generatedBid.pricingModel.totalBidPrice}
                    color="bg-primary"
                  />
                  <CostLine
                    label="Human Oversight & QA"
                    value={generatedBid.pricingModel.humanCosts}
                    total={generatedBid.pricingModel.totalBidPrice}
                    color="bg-amber-500"
                  />
                  <CostLine
                    label="Infrastructure & Tooling"
                    value={generatedBid.pricingModel.infrastructure}
                    total={generatedBid.pricingModel.totalBidPrice}
                    color="bg-cyan-500"
                  />
                  <CostLine
                    label="Overhead & Admin"
                    value={generatedBid.pricingModel.overhead}
                    total={generatedBid.pricingModel.totalBidPrice}
                    color="bg-purple-500"
                  />
                  <CostLine
                    label="Profit Margin"
                    value={generatedBid.pricingModel.margin}
                    total={generatedBid.pricingModel.totalBidPrice}
                    color="bg-emerald-500"
                  />
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function BidGeneratorPage() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-96 w-full" /></div>}>
      <BidGeneratorContent />
    </Suspense>
  );
}

function Step({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function CostLine({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-bold font-mono">
          {formatCurrency(value)} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted/50">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function generateMockBid(title: string, description: string, value: number): GeneratedBid {
  return {
    complianceMatrix: [
      { requirement: "Demonstrated experience in similar projects", section: "M1", mandatory: true, response: "GovBot AI has processed over 500 similar contract opportunities and generated fulfillment strategies for each.", status: "met" },
      { requirement: "Bilingual delivery capacity (EN/FR)", section: "M2", mandatory: true, response: "Our AI-powered pipeline includes neural translation with 98%+ accuracy for EN/FR government content.", status: "met" },
      { requirement: "Quality assurance methodology", section: "M3", mandatory: true, response: "Multi-layer QA: automated validation, human spot-check (10% sample), and client approval workflow.", status: "met" },
      { requirement: "Data security and privacy compliance", section: "M4", mandatory: true, response: "All data processing occurs in Canadian data centers. SOC 2 Type II compliant infrastructure.", status: "met" },
      { requirement: "Project management approach", section: "R1", mandatory: false, response: "Agile delivery with bi-weekly sprints, dedicated PM, and real-time progress dashboard.", status: "met" },
      { requirement: "Past performance references", section: "R2", mandatory: false, response: "Available upon request. Portfolio includes similar AI-enhanced service delivery projects.", status: "partial" },
    ],
    proposalSections: [
      { title: "Executive Summary", content: `We are pleased to submit our proposal for "${title}". Our AI-enhanced delivery model combines cutting-edge artificial intelligence with expert human oversight to deliver superior results at competitive pricing. Our approach reduces delivery time by 3-5x while maintaining the highest quality standards required by the Government of Canada.\n\nOur team brings deep expertise in AI-powered service delivery, backed by proven methodologies refined across hundreds of similar engagements. We understand the unique requirements of federal procurement and are committed to delivering exceptional value.`, wordCount: 85 },
      { title: "Understanding of Requirements", content: `Based on our thorough analysis of the requirements, we understand that ${description}\n\nOur approach specifically addresses each requirement through a combination of AI automation and expert human oversight, ensuring compliance with all mandatory criteria while exceeding expectations on rated criteria.`, wordCount: 55 },
      { title: "Technical Approach & Methodology", content: "Our methodology follows a proven four-phase approach:\n\n1. Discovery & Planning: We begin with a detailed requirements analysis workshop to align our delivery approach with your specific needs and success criteria.\n\n2. AI Pipeline Configuration: We configure our AI processing pipeline with domain-specific training, custom quality rules, and output formatting templates.\n\n3. Production & Quality Assurance: Our AI engine handles the primary workload at 10x throughput, while human reviewers validate a statistically significant sample of all outputs.\n\n4. Delivery & Iteration: Deliverables are provided on an agreed schedule with built-in revision cycles and continuous improvement based on feedback.", wordCount: 110 },
      { title: "AI-Enhanced Delivery Model", content: "Our proprietary AI delivery model represents a fundamental advancement in how professional services are delivered to government. Rather than replacing human expertise, we augment it:\n\n- AI handles repetitive, high-volume processing tasks at 10-50x human speed\n- Human experts focus on quality validation, edge cases, and strategic decisions\n- Automated QA catches errors before human review, reducing rework by 80%\n- Real-time dashboards provide full transparency into progress and quality metrics\n\nThis model allows us to offer competitive pricing while maintaining or exceeding the quality standards expected by the Government of Canada.", wordCount: 100 },
      { title: "Quality Assurance Plan", content: "Quality is non-negotiable. Our multi-layer QA framework includes:\n\n- Automated validation: AI-powered checks against style guides, terminology databases, and compliance rules\n- Statistical sampling: Human expert review of 10-15% of all outputs\n- Client approval workflow: All deliverables pass through a structured approval process\n- Continuous monitoring: Real-time quality metrics dashboard with alerting for anomalies\n- Corrective action: Documented procedures for identifying, tracking, and resolving quality issues", wordCount: 80 },
      { title: "Project Management & Timeline", content: "We propose an Agile delivery framework with:\n\n- Dedicated Project Manager as single point of contact\n- Bi-weekly sprint cycles with demo sessions\n- Weekly status reports and monthly executive summaries\n- Risk register maintained and reviewed bi-weekly\n- Change management process aligned with GC standards\n\nEstimated timeline: [To be refined based on detailed requirements review]", wordCount: 65 },
    ],
    pricingModel: {
      totalBidPrice: Math.round(value * 0.85),
      aiCosts: Math.round(value * 0.08),
      humanCosts: Math.round(value * 0.22),
      infrastructure: Math.round(value * 0.05),
      overhead: Math.round(value * 0.07),
      margin: Math.round(value * 0.43),
      marginPercent: 50,
    },
  };
}
