"use client";

import { useState } from "react";
import { Tender } from "@/types/tender";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CATEGORY_COLORS, AI_CATEGORIES } from "@/lib/constants";
import {
  formatCurrency,
  daysUntil,
  getScoreColor,
  getScoreBg,
  getUrgencyColor,
  estimateFinancials,
} from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { AICategory } from "@/types/tender";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  FileEdit,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface TenderDetailProps {
  tender: Tender;
}

const PIPELINE_STAGES = [
  { value: "interested", label: "Interested", color: "text-blue-600" },
  { value: "qualifying", label: "Qualifying", color: "text-cyan-600" },
  { value: "bidding", label: "Bidding", color: "text-amber-600" },
  { value: "submitted", label: "Submitted", color: "text-purple-600" },
  { value: "won", label: "Won", color: "text-emerald-600" },
  { value: "lost", label: "Lost", color: "text-red-500" },
  { value: "no_bid", label: "No Bid", color: "text-muted-foreground" },
];

export function TenderDetail({ tender }: TenderDetailProps) {
  const [activeTab, setActiveTab] = useState("fulfillment");
  const [isSaved, setIsSaved] = useState(false);
  const [pipelineStage, setPipelineStage] = useState("interested");
  const days = daysUntil(tender.closingDate);
  const score = tender.computedScore || 0;
  const af = tender.aiFulfillment;
  const financials = estimateFinancials(tender);

  const handleSave = async () => {
    setIsSaved(!isSaved);
    if (!isSaved) {
      try {
        await fetch("/api/saved-tenders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenderId: tender.id, stage: pipelineStage }),
        });
        toast.success("Tender saved to pipeline");
      } catch {
        toast.success("Saved (connect Supabase to persist)");
      }
    } else {
      try {
        await fetch(`/api/saved-tenders?tenderId=${tender.id}`, { method: "DELETE" });
        toast.info("Removed from pipeline");
      } catch {
        toast.info("Removed");
      }
    }
  };

  const handleStageChange = async (stage: string) => {
    setPipelineStage(stage);
    if (isSaved) {
      try {
        await fetch("/api/saved-tenders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenderId: tender.id, stage }),
        });
        toast.success(`Stage updated to ${stage}`);
      } catch {
        // Silent in demo mode
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-xs font-semibold text-primary">
            {tender.externalId}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {tender.solicitationType}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {tender.source}
          </Badge>
        </div>
        <h2 className="text-xl font-bold leading-tight mb-3">
          {tender.title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {tender.description}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-3 bg-white shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Score
          </p>
          <p className={cn("text-xl font-extrabold font-mono", getScoreColor(score))}>
            {score}
          </p>
        </Card>
        <Card className="p-3 bg-white shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            AI Fit
          </p>
          <p className="text-xl font-extrabold font-mono text-emerald-600">
            {tender.aiScore}%
          </p>
        </Card>
        <Card className="p-3 bg-white shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Value
          </p>
          <p className="text-xl font-extrabold font-mono text-amber-600">
            {formatCurrency(tender.estimatedValue)}
          </p>
        </Card>
        <Card className="p-3 bg-white shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Deadline
          </p>
          <p className={cn("text-xl font-extrabold font-mono", getUrgencyColor(days))}>
            {days}d
          </p>
        </Card>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {tender.aiCategories.map((cat) => (
          <Badge
            key={cat}
            variant="outline"
            className={cn("text-xs", CATEGORY_COLORS[cat])}
          >
            {AI_CATEGORIES[cat as AICategory]?.label || cat}
          </Badge>
        ))}
      </div>

      {/* Pipeline Stage */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          size="sm"
          variant={isSaved ? "default" : "outline"}
          onClick={handleSave}
        >
          {isSaved ? (
            <BookmarkCheck className="mr-2 h-4 w-4" />
          ) : (
            <Bookmark className="mr-2 h-4 w-4" />
          )}
          {isSaved ? "Saved" : "Save"}
        </Button>
        <Select value={pipelineStage} onValueChange={handleStageChange}>
          <SelectTrigger className="w-[150px] h-8 text-xs bg-muted/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PIPELINE_STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <span className={s.color}>{s.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button size="sm" asChild>
          <Link href={`/bid-generator?tender=${tender.id}&title=${encodeURIComponent(tender.title)}&dept=${encodeURIComponent(tender.department)}&desc=${encodeURIComponent(tender.description.slice(0, 500))}&value=${tender.estimatedValue}`}>
            <FileEdit className="mr-2 h-4 w-4" />
            Generate Bid
          </Link>
        </Button>
        {tender.sourceUrl && (
          <Button size="sm" variant="outline" asChild>
            <a href={tender.sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View on {tender.source}
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <a href="/api/export?type=tenders&format=csv" download>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>

      <Separator className="mb-6" />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start bg-muted/50">
          <TabsTrigger value="fulfillment">AI Fulfillment</TabsTrigger>
          <TabsTrigger value="qualification">Qualification</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
        </TabsList>

        <TabsContent value="fulfillment" className="mt-4 space-y-5">
          {af ? (
            <>
              <Section title="AI Fulfillment Strategy" icon={Zap}>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {af.approach}
                </p>
              </Section>

              <Section title="Technology Stack" icon={Shield}>
                <div className="flex flex-wrap gap-2">
                  {af.tools.map((tool, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="bg-primary/5 text-primary border-primary/15"
                    >
                      {tool}
                    </Badge>
                  ))}
                </div>
              </Section>

              <Section title="Human Oversight" icon={Users}>
                <p className="text-sm text-muted-foreground">
                  {af.humanOversight}
                </p>
              </Section>

              <Section title="Risks" icon={AlertTriangle}>
                <div className="space-y-2">
                  {af.risks.map((risk, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2"
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        {risk}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>

              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3 bg-emerald-50 border-emerald-200">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Cost Reduction
                  </p>
                  <p className="text-lg font-extrabold font-mono text-emerald-600">
                    {af.costReduction}
                  </p>
                </Card>
                <Card className="p-3 bg-primary/5 border-primary/15">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Delivery Speed
                  </p>
                  <p className="text-lg font-extrabold font-mono text-primary">
                    {af.deliverySpeed}
                  </p>
                </Card>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No AI fulfillment plan has been generated for this tender yet.
            </p>
          )}
        </TabsContent>

        <TabsContent value="qualification" className="mt-4 space-y-5">
          <Section title="Bid Requirements">
            <div className="space-y-2">
              <CheckItem label="Registered on CanadaBuys / SAP Ariba" status="required" />
              <CheckItem label="Procurement Business Number (PBN)" status="required" />
              <CheckItem
                label={`Trade Agreements: ${tender.tradeAgreements.join(", ") || "None specified"}`}
                status="required"
              />
              <CheckItem label="Bilingual Capacity (EN/FR)" status="required" />
              <CheckItem label="Prior GC Contract Experience" status="recommended" />
              <CheckItem label="Security Clearance" status={tender.aiScore > 90 ? "not-required" : "recommended"} />
              <CheckItem label="ISO 27001 Certification" status="recommended" />
            </div>
          </Section>

          <Section title="Competitive Landscape">
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 bg-white shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Est. Bidders
                </p>
                <p className="text-lg font-extrabold font-mono text-amber-600">
                  ~{tender.competitorCount}
                </p>
              </Card>
              <Card className="p-3 bg-white shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Complexity
                </p>
                <p className={cn(
                  "text-lg font-extrabold font-mono",
                  tender.bidComplexity === "High" ? "text-red-500" : tender.bidComplexity === "Medium" ? "text-amber-600" : "text-emerald-600"
                )}>
                  {tender.bidComplexity}
                </p>
              </Card>
              <Card className="p-3 bg-emerald-50 border-emerald-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Advantage
                </p>
                <p className="text-lg font-extrabold font-mono text-emerald-600">
                  Strong
                </p>
              </Card>
            </div>
          </Section>

          <Section title="Details">
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">Region: </span>
                {tender.region}
              </div>
              <div>
                <span className="font-semibold text-foreground">Category: </span>
                {tender.category === "SRV" ? "Services" : tender.category}
              </div>
              <div>
                <span className="font-semibold text-foreground">GSIN: </span>
                {tender.gsin}
              </div>
              <div>
                <span className="font-semibold text-foreground">Published: </span>
                {new Date(tender.publicationDate).toLocaleDateString("en-CA")}
              </div>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="financials" className="mt-4 space-y-5">
          <Section title="Revenue Model">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Card className="p-3 bg-white shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Contract Value
                </p>
                <p className="text-lg font-extrabold font-mono">
                  {formatCurrency(financials.contractValue)}
                </p>
              </Card>
              <Card className="p-3 bg-red-50 border-red-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Delivery Cost
                </p>
                <p className="text-lg font-extrabold font-mono text-red-500">
                  {formatCurrency(financials.deliveryCost)}
                </p>
              </Card>
              <Card className="p-3 bg-emerald-50 border-emerald-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Gross Profit
                </p>
                <p className="text-lg font-extrabold font-mono text-emerald-600">
                  {formatCurrency(financials.grossProfit)}
                </p>
              </Card>
            </div>
            <Card className="p-3 bg-emerald-50 border-emerald-200 inline-block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Estimated Margin
              </p>
              <p className="text-xl font-extrabold font-mono text-emerald-600">
                {financials.margin}%
              </p>
            </Card>
          </Section>

          <Section title="Cost Breakdown">
            <div className="space-y-3">
              <CostBar label="AI API Costs" value={financials.breakdown.aiCosts} total={financials.deliveryCost} color="bg-primary" />
              <CostBar label="Human Oversight" value={financials.breakdown.humanCosts} total={financials.deliveryCost} color="bg-amber-500" />
              <CostBar label="Infrastructure" value={financials.breakdown.infrastructure} total={financials.deliveryCost} color="bg-cyan-500" />
              <CostBar label="Overhead & Admin" value={financials.breakdown.overhead} total={financials.deliveryCost} color="bg-purple-500" />
              <CostBar label="QA & Compliance" value={financials.breakdown.qa} total={financials.deliveryCost} color="bg-pink-500" />
            </div>
          </Section>

          <Section title="Scalability">
            <p className="text-sm text-muted-foreground leading-relaxed">
              AI fulfillment enables bidding on multiple contracts simultaneously without
              proportional headcount increases. Each additional contract adds ~15-25%
              marginal cost vs. 80-100% for traditional service providers.
            </p>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function CheckItem({
  label,
  status,
}: {
  label: string;
  status: "required" | "recommended" | "not-required";
}) {
  return (
    <div className="flex items-center gap-2.5">
      {status === "required" && (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
      )}
      {status === "recommended" && (
        <Circle className="h-4 w-4 text-amber-600 flex-shrink-0" />
      )}
      {status === "not-required" && (
        <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
      <span className="text-sm text-muted-foreground flex-1">{label}</span>
      <span className="text-[10px] font-semibold text-muted-foreground uppercase">
        {status.replace("-", " ")}
      </span>
    </div>
  );
}

function CostBar({
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
      <div className="flex justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-bold font-mono text-foreground">
          {formatCurrency(value)} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/50">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
