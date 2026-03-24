import { Tender, BidComplexity, TenderBlocker } from "@/types/tender";
import { SCORING_WEIGHTS } from "./constants";
import { getConfigSection } from "./config";

export function computeOpportunityScore(tender: Tender): number {
  const scoringCfg = getConfigSection("scoring");
  const w = scoringCfg.weights;

  const aiScore = typeof tender.aiScore === "number" && !isNaN(tender.aiScore) ? tender.aiScore : 0;
  const aiNorm = Math.min(Math.max(aiScore / 100, 0), 1);

  const value = typeof tender.estimatedValue === "number" && !isNaN(tender.estimatedValue) ? tender.estimatedValue : 0;
  const valueNorm = Math.min(Math.max(value / 1_000_000, 0), 1);

  const competitors = typeof tender.competitorCount === "number" && !isNaN(tender.competitorCount) ? tender.competitorCount : 10;
  const competitionNorm = 1 - Math.min(Math.max(competitors / scoringCfg.maxCompetitors, 0), 1);

  const daysLeft = daysUntil(tender.closingDate);
  const timeNorm = isNaN(daysLeft) || daysLeft <= 3
    ? 0.05
    : daysLeft <= 7
      ? 0.2
      : daysLeft <= 60
        ? Math.min(daysLeft / 60, 1)
        : 0.8;

  const complexityMap: Record<BidComplexity, number> = { Low: 1, Medium: 0.7, High: 0.4 };
  const complexityNorm = complexityMap[tender.bidComplexity] || 0.5;

  let costRedNorm = 0.5;
  if (tender.aiFulfillment?.costReduction) {
    const parsed = parseInt(String(tender.aiFulfillment.costReduction).replace(/[^0-9]/g, ""));
    if (!isNaN(parsed)) costRedNorm = Math.min(Math.max(parsed / 100, 0), 1);
  }

  const rawScore = (
    aiNorm * w.aiSuitability +
    valueNorm * w.contractValue +
    competitionNorm * w.competitionLevel +
    timeNorm * w.timeline +
    complexityNorm * w.bidComplexity +
    costRedNorm * w.costReduction
  ) * 100;

  // Apply risk tolerance adjustment
  const riskCfg = getConfigSection("risk");
  let adjustedScore = rawScore;
  if (riskCfg.riskTolerance === "aggressive") {
    adjustedScore = Math.min(rawScore * 1.1, 100);
  } else if (riskCfg.riskTolerance === "conservative") {
    adjustedScore = rawScore * 0.9;
  }

  return Math.round(Math.min(Math.max(adjustedScore, 0), 100));
}

// ─── Blocker Detection ───────────────────────────────────────────────────────
// Scans tender text for keywords that indicate disqualifying or risk-adding requirements.
// Hard blockers = skip this contract. Soft blockers = manageable with preparation.

const HARD_BLOCKER_PATTERNS: Array<{ pattern: RegExp; type: TenderBlocker["type"]; label: string }> = [
  { pattern: /secret|top secret|enhanced reliability|security clearance|security level/i, type: "clearance", label: "Security Clearance Required" },
  { pattern: /professional engineer|p\.eng|cpa|chartered accountant|licensed architect|licensed lawyer|barrister|solicitor|notary|physician|registered nurse|pharmacist/i, type: "license", label: "Professional License Required" },
  { pattern: /must be located in|physical presence required|on-?site mandatory|on-?site presence/i, type: "physical_presence", label: "Mandatory On-site Presence" },
  { pattern: /canadian citizen only|must be a canadian citizen/i, type: "foreign", label: "Canadian Citizenship Required" },
];

const SOFT_BLOCKER_PATTERNS: Array<{ pattern: RegExp; type: TenderBlocker["type"]; label: string }> = [
  { pattern: /incumbent|current service provider|existing contract|previous supplier/i, type: "incumbency", label: "Possible Incumbent Advantage" },
  { pattern: /reliability clearance|basic security check/i, type: "clearance", label: "Reliability Clearance (obtainable)" },
  { pattern: /liability insurance|errors and omissions|professional liability/i, type: "insurance", label: "Professional Insurance Required" },
  { pattern: /bilingual|french and english|anglais et français/i, type: "license", label: "Bilingual Delivery Required" },
];

export function detectBlockers(tender: Tender): TenderBlocker[] {
  const text = [tender.title ?? "", tender.description ?? "", tender.category ?? ""].join(" ").toLowerCase();
  const blockers: TenderBlocker[] = [];
  const blockerCfg = getConfigSection("blockers");

  for (const { pattern, type, label } of HARD_BLOCKER_PATTERNS) {
    if (pattern.test(text)) {
      // Check if user's config downgrades this hard blocker to soft
      const downgraded =
        (type === "clearance" && blockerCfg.hasSecurityClearance) ||
        (type === "license" && blockerCfg.hasProfessionalLicense.length > 0) ||
        (type === "physical_presence" && blockerCfg.canBeOnSite) ||
        (type === "foreign" && blockerCfg.isCanadianCitizen);

      blockers.push({ type, label, severity: downgraded ? "soft" : "hard" });
    }
  }

  for (const { pattern, type, label } of SOFT_BLOCKER_PATTERNS) {
    if (pattern.test(text)) {
      if (!blockers.find((b) => b.type === type)) {
        // Check if user's config eliminates this soft blocker entirely
        const eliminated =
          (type === "insurance" && blockerCfg.hasProfessionalInsurance) ||
          (type === "license" && blockerCfg.isBilingual);

        if (!eliminated) {
          blockers.push({ type, label, severity: "soft" });
        }
      }
    }
  }

  // Check excluded keywords from scanning config
  const excludeKeywords = getConfigSection("scanning").excludeKeywords;
  for (const keyword of excludeKeywords) {
    if (text.includes(keyword.toLowerCase())) {
      blockers.push({
        type: "excluded_keyword",
        label: `Excluded keyword: ${keyword}`,
        severity: "soft",
      });
    }
  }

  return blockers;
}

export function hasHardBlocker(tender: Tender): boolean {
  const blockers = tender.blockers ?? detectBlockers(tender);
  return blockers.some((b) => b.severity === "hard");
}

// ─── Utilities ───────────────────────────────────────────────────────────────

export function daysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return 999;
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatCurrency(value: number): string {
  if (typeof value !== "number" || isNaN(value)) return "$0";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getScoreColor(score: number): string {
  const t = getConfigSection("scoring").scoreThresholds;
  if (score >= t.high) return "text-emerald-600";
  if (score >= t.medium) return "text-amber-600";
  return "text-red-500";
}

export function getScoreBg(score: number): string {
  const t = getConfigSection("scoring").scoreThresholds;
  if (score >= t.high) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (score >= t.medium) return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-red-50 border-red-200 text-red-600";
}

export function getUrgencyColor(daysLeft: number): string {
  const u = getConfigSection("scoring").urgencyDays;
  if (daysLeft <= u.critical) return "text-red-500";
  if (daysLeft <= u.warning) return "text-amber-600";
  if (daysLeft <= u.approaching) return "text-amber-500";
  return "text-muted-foreground";
}

export function estimateFinancials(tender: Tender) {
  const biddingCfg = getConfigSection("bidding");
  let costReductionPct = biddingCfg.defaultCostReduction / 100;
  if (tender.aiFulfillment?.costReduction) {
    const parsed = parseInt(String(tender.aiFulfillment.costReduction).replace(/[^0-9]/g, ""));
    if (!isNaN(parsed)) costReductionPct = parsed / 100;
  }

  const contractValue = typeof tender.estimatedValue === "number" ? tender.estimatedValue : 0;
  const deliveryCost = contractValue * (1 - costReductionPct) * 0.6;
  const grossProfit = contractValue - deliveryCost;
  const margin = contractValue > 0 ? (grossProfit / contractValue) * 100 : 0;

  const cb = biddingCfg.costBreakdown;
  const aiCosts = deliveryCost * cb.aiCosts;
  const humanCosts = deliveryCost * cb.humanCosts;
  const infrastructure = deliveryCost * cb.infrastructure;
  const overhead = deliveryCost * cb.overhead;
  const qa = deliveryCost * cb.qa;

  return {
    contractValue,
    deliveryCost: Math.round(deliveryCost),
    grossProfit: Math.round(grossProfit),
    margin: Math.round(margin),
    breakdown: {
      aiCosts: Math.round(aiCosts),
      humanCosts: Math.round(humanCosts),
      infrastructure: Math.round(infrastructure),
      overhead: Math.round(overhead),
      qa: Math.round(qa),
    },
  };
}
