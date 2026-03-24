// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Award Intelligence & Pricing Optimization
// Analyzes historical award data to recommend bid pricing and strategy
// ═══════════════════════════════════════════════════════════════════

import { AwardNotice } from "@/types/tender";
import { MOCK_AWARDS } from "@/lib/mock-data";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PricingRecommendation {
  recommendedBidPrice: number;
  bidAsPercentOfEstimate: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  historicalRange: { low: number; high: number };
  sampleSize: number;
  competitionLevel: "low" | "medium" | "high";
}

export interface AwardIntelSummary {
  totalAwards: number;
  totalAwardValue: number;
  uniqueVendors: number;
  uniqueDepartments: number;
  avgContractValue: number;
  topCategory: string;
  topDepartment: string;
  dataFreshness: string;
}

// ─── Module-level in-memory store ────────────────────────────────────────────

const awardStore: Map<string, AwardNotice> = new Map();

// Seed with mock data on import
for (const award of MOCK_AWARDS) {
  awardStore.set(award.id, award);
}

// ─── Data Management ─────────────────────────────────────────────────────────

export function addAwards(awards: AwardNotice[]): void {
  for (const award of awards) {
    awardStore.set(award.id, award);
  }
}

export function listAwards(): AwardNotice[] {
  return Array.from(awardStore.values());
}

export function getAwardCount(): number {
  return awardStore.size;
}

// ─── Analytics Helpers ───────────────────────────────────────────────────────

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key);
    if (arr) {
      arr.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Derive a human-readable category from the award title using keyword matching.
 */
function deriveCategory(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("translation")) return "Translation";
  if (lower.includes("data") && (lower.includes("analy") || lower.includes("report"))) return "Data Analysis";
  if (lower.includes("training") || lower.includes("learning")) return "Training";
  if (lower.includes("audit") || lower.includes("accessibility")) return "Audit";
  if (lower.includes("communication") || lower.includes("comms")) return "Communications";
  if (lower.includes("policy") || lower.includes("research")) return "Policy Research";
  if (lower.includes("document") || lower.includes("digitiz")) return "Document Processing";
  if (lower.includes("security") || lower.includes("it ") || lower.includes("cyber")) return "IT Security";
  if (lower.includes("survey") || lower.includes("poll")) return "Survey";
  if (lower.includes("transcription") || lower.includes("hansard")) return "Transcription";
  if (lower.includes("writing") || lower.includes("content")) return "Writing";
  if (lower.includes("testing") || lower.includes("qa")) return "Testing";
  return "Other";
}

// ─── Analytics Functions ─────────────────────────────────────────────────────

/**
 * Average award value by department, sorted by avgValue descending.
 */
export function avgAwardByDepartment(): Array<{
  department: string;
  avgValue: number;
  count: number;
}> {
  const awards = listAwards();
  if (awards.length === 0) return [];

  const groups = groupBy(awards, (a) => a.department);
  const results: Array<{ department: string; avgValue: number; count: number }> = [];

  for (const [department, items] of groups) {
    const total = items.reduce((sum, a) => sum + a.contractValue, 0);
    results.push({
      department,
      avgValue: Math.round(total / items.length),
      count: items.length,
    });
  }

  return results.sort((a, b) => b.avgValue - a.avgValue);
}

/**
 * Average award value by derived category (keyword-matched from title),
 * sorted by avgValue descending.
 */
export function avgAwardByCategory(): Array<{
  category: string;
  avgValue: number;
  count: number;
}> {
  const awards = listAwards();
  if (awards.length === 0) return [];

  const groups = groupBy(awards, (a) => deriveCategory(a.title));
  const results: Array<{ category: string; avgValue: number; count: number }> = [];

  for (const [category, items] of groups) {
    const total = items.reduce((sum, a) => sum + a.contractValue, 0);
    results.push({
      category,
      avgValue: Math.round(total / items.length),
      count: items.length,
    });
  }

  return results.sort((a, b) => b.avgValue - a.avgValue);
}

/**
 * Top vendors by total value won, sorted descending.
 */
export function topVendors(
  limit: number = 10
): Array<{
  vendor: string;
  totalValue: number;
  contractCount: number;
  avgValue: number;
}> {
  const awards = listAwards();
  if (awards.length === 0) return [];

  const groups = groupBy(awards, (a) => a.vendorName);
  const results: Array<{
    vendor: string;
    totalValue: number;
    contractCount: number;
    avgValue: number;
  }> = [];

  for (const [vendor, items] of groups) {
    const totalValue = items.reduce((sum, a) => sum + a.contractValue, 0);
    results.push({
      vendor,
      totalValue,
      contractCount: items.length,
      avgValue: Math.round(totalValue / items.length),
    });
  }

  return results.sort((a, b) => b.totalValue - a.totalValue).slice(0, limit);
}

/**
 * Departments with the fewest unique vendors (lowest competition),
 * sorted by uniqueVendors ascending.
 */
export function lowCompetitionDepts(): Array<{
  department: string;
  uniqueVendors: number;
  totalAwards: number;
  avgValue: number;
}> {
  const awards = listAwards();
  if (awards.length === 0) return [];

  const groups = groupBy(awards, (a) => a.department);
  const results: Array<{
    department: string;
    uniqueVendors: number;
    totalAwards: number;
    avgValue: number;
  }> = [];

  for (const [department, items] of groups) {
    const vendors = new Set(items.map((a) => a.vendorName));
    const totalValue = items.reduce((sum, a) => sum + a.contractValue, 0);
    results.push({
      department,
      uniqueVendors: vendors.size,
      totalAwards: items.length,
      avgValue: Math.round(totalValue / items.length),
    });
  }

  return results.sort((a, b) => a.uniqueVendors - b.uniqueVendors);
}

/**
 * Recommend a bid price based on historical award data.
 *
 * Strategy:
 *  - Find matching awards by department and/or category
 *  - Assess competition level from unique vendor count
 *  - Filter to similar-sized awards (within 50% of estimated value)
 *  - Recommend 78-88% of estimate, adjusted by competition
 */
export function recommendPrice(params: {
  department: string;
  category: string;
  estimatedValue: number;
}): PricingRecommendation {
  const { department, category, estimatedValue } = params;
  const allAwards = listAwards();

  // Default fallback when no data exists
  const defaultResult: PricingRecommendation = {
    recommendedBidPrice: Math.round(estimatedValue * 0.82),
    bidAsPercentOfEstimate: 82,
    confidence: "low",
    reasoning:
      "No historical award data available for this department or category. Defaulting to 82% of estimated value as a balanced bid.",
    historicalRange: { low: 78, high: 88 },
    sampleSize: 0,
    competitionLevel: "medium",
  };

  if (allAwards.length === 0 || estimatedValue <= 0) {
    return defaultResult;
  }

  // Step 1: Find matching awards by department (exact) and/or category (keyword)
  const deptLower = department.toLowerCase();
  const categoryDerived = deriveCategory(category);

  const deptMatches = allAwards.filter(
    (a) => a.department.toLowerCase() === deptLower
  );
  const catMatches = allAwards.filter(
    (a) => deriveCategory(a.title) === categoryDerived
  );

  // Prefer awards matching both; fall back to either
  let matchPool: AwardNotice[] = deptMatches.filter((a) =>
    catMatches.some((c) => c.id === a.id)
  );
  if (matchPool.length === 0) {
    matchPool = deptMatches.length > 0 ? deptMatches : catMatches;
  }
  if (matchPool.length === 0) {
    // Fall back to all awards
    matchPool = allAwards;
  }

  // Step 2: Filter to similar-sized awards (within 50% of estimated value)
  const lowerBound = estimatedValue * 0.5;
  const upperBound = estimatedValue * 1.5;
  let sizeMatches = matchPool.filter(
    (a) => a.contractValue >= lowerBound && a.contractValue <= upperBound
  );

  // If size filtering removes everything, use the full match pool
  if (sizeMatches.length === 0) {
    sizeMatches = matchPool;
  }

  // Step 3: Determine competition level from the department's vendor diversity
  const deptVendors = new Set(deptMatches.map((a) => a.vendorName));
  let competitionLevel: "low" | "medium" | "high";
  if (deptVendors.size <= 1) {
    competitionLevel = "low";
  } else if (deptVendors.size <= 3) {
    competitionLevel = "medium";
  } else {
    competitionLevel = "high";
  }

  // Step 4: Calculate recommended bid percentage
  // Base: low competition = 85%, medium = 82%, high = 78%
  let bidPercent: number;
  switch (competitionLevel) {
    case "low":
      bidPercent = 85;
      break;
    case "medium":
      bidPercent = 82;
      break;
    case "high":
      bidPercent = 78;
      break;
  }

  // Adjust slightly based on historical median vs. estimated value
  const medianAward = median(sizeMatches.map((a) => a.contractValue));
  if (medianAward > 0 && estimatedValue > 0) {
    const ratio = medianAward / estimatedValue;
    // If historical awards are typically lower than estimates, bid lower
    if (ratio < 0.8) {
      bidPercent = Math.max(78, bidPercent - 2);
    }
    // If historical awards are close to or above estimates, can bid higher
    if (ratio > 0.95) {
      bidPercent = Math.min(88, bidPercent + 2);
    }
  }

  // Step 5: Determine confidence
  const sampleSize = sizeMatches.length;
  let confidence: "high" | "medium" | "low";
  if (sampleSize >= 10) {
    confidence = "high";
  } else if (sampleSize >= 3) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  // Step 6: Compute historical range as % of estimated value
  const awardValues = sizeMatches.map((a) => a.contractValue);
  const minVal = Math.min(...awardValues);
  const maxVal = Math.max(...awardValues);
  const rangeLow =
    estimatedValue > 0 ? Math.round((minVal / estimatedValue) * 100) : 78;
  const rangeHigh =
    estimatedValue > 0 ? Math.round((maxVal / estimatedValue) * 100) : 88;

  // Step 7: Build reasoning
  const matchContext =
    deptMatches.length > 0 && catMatches.length > 0
      ? `${sampleSize} historical awards matching department and category`
      : deptMatches.length > 0
        ? `${sampleSize} historical awards from ${department}`
        : catMatches.length > 0
          ? `${sampleSize} historical awards in the ${categoryDerived} category`
          : `${sampleSize} awards from the general dataset`;

  const competitionNote =
    competitionLevel === "low"
      ? "Low competition in this department allows for a higher bid margin."
      : competitionLevel === "high"
        ? "High competition in this department suggests bidding aggressively on price."
        : "Moderate competition suggests a balanced pricing approach.";

  const reasoning = `Based on ${matchContext}, the median contract value is $${medianAward.toLocaleString()}. ${competitionNote}`;

  return {
    recommendedBidPrice: Math.round(estimatedValue * (bidPercent / 100)),
    bidAsPercentOfEstimate: bidPercent,
    confidence,
    reasoning,
    historicalRange: { low: rangeLow, high: rangeHigh },
    sampleSize,
    competitionLevel,
  };
}

// ─── Dashboard Summary ───────────────────────────────────────────────────────

/**
 * Returns a high-level summary of award intelligence data for dashboard display.
 */
export function getIntelSummary(): AwardIntelSummary {
  const awards = listAwards();

  if (awards.length === 0) {
    return {
      totalAwards: 0,
      totalAwardValue: 0,
      uniqueVendors: 0,
      uniqueDepartments: 0,
      avgContractValue: 0,
      topCategory: "N/A",
      topDepartment: "N/A",
      dataFreshness: "No data",
    };
  }

  const totalAwardValue = awards.reduce((sum, a) => sum + a.contractValue, 0);
  const vendors = new Set(awards.map((a) => a.vendorName));
  const departments = new Set(awards.map((a) => a.department));

  // Top category by total value
  const catGroups = groupBy(awards, (a) => deriveCategory(a.title));
  let topCategory = "N/A";
  let topCatValue = 0;
  for (const [cat, items] of catGroups) {
    const total = items.reduce((sum, a) => sum + a.contractValue, 0);
    if (total > topCatValue) {
      topCatValue = total;
      topCategory = cat;
    }
  }

  // Top department by total value
  const deptGroups = groupBy(awards, (a) => a.department);
  let topDepartment = "N/A";
  let topDeptValue = 0;
  for (const [dept, items] of deptGroups) {
    const total = items.reduce((sum, a) => sum + a.contractValue, 0);
    if (total > topDeptValue) {
      topDeptValue = total;
      topDepartment = dept;
    }
  }

  // Data freshness — based on most recent award date
  const mostRecent = awards.reduce((latest, a) => {
    return a.awardDate > latest ? a.awardDate : latest;
  }, "");

  let dataFreshness = "Unknown";
  if (mostRecent) {
    const now = new Date();
    const recentDate = new Date(mostRecent);
    const diffMs = now.getTime() - recentDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    dataFreshness = diffDays === 0 ? "Today" : `${diffDays} days old`;
  }

  return {
    totalAwards: awards.length,
    totalAwardValue,
    uniqueVendors: vendors.size,
    uniqueDepartments: departments.size,
    avgContractValue: Math.round(totalAwardValue / awards.length),
    topCategory,
    topDepartment,
    dataFreshness,
  };
}
