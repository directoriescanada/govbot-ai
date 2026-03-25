// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Win/Loss Feedback Loop
// Records bid outcomes and derives scoring adjustments from patterns
// ═══════════════════════════════════════════════════════════════════

import { useSupabase } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeedbackRecord {
  id: string;
  contractId: string;
  outcome: "won" | "lost";
  notes: string;
  department: string;
  category: string;
  bidPrice: number;
  estimatedValue: number;
  createdAt: string;
}

// ─── In-memory fallback store ────────────────────────────────────────────────

const feedbackStore = new Map<string, FeedbackRecord>();

// Seed with demo data
const DEMO_FEEDBACK: FeedbackRecord[] = [
  { id: "fb_1", contractId: "c_1", outcome: "won", notes: "Strong technical proposal", department: "Public Services and Procurement Canada", category: "Translation", bidPrice: 42000, estimatedValue: 50000, createdAt: "2025-01-15T10:00:00Z" },
  { id: "fb_2", contractId: "c_2", outcome: "lost", notes: "Price too high", department: "Transport Canada", category: "Data Analysis", bidPrice: 95000, estimatedValue: 100000, createdAt: "2025-01-20T10:00:00Z" },
  { id: "fb_3", contractId: "c_3", outcome: "won", notes: "AI delivery model impressed", department: "Public Services and Procurement Canada", category: "Translation", bidPrice: 38000, estimatedValue: 45000, createdAt: "2025-02-05T10:00:00Z" },
  { id: "fb_4", contractId: "c_4", outcome: "won", notes: "Lowest compliant bidder", department: "Employment and Social Development Canada", category: "Training", bidPrice: 55000, estimatedValue: 75000, createdAt: "2025-02-10T10:00:00Z" },
  { id: "fb_5", contractId: "c_5", outcome: "lost", notes: "Incumbent advantage", department: "Innovation, Science and Economic Development Canada", category: "IT Security", bidPrice: 120000, estimatedValue: 150000, createdAt: "2025-03-01T10:00:00Z" },
  { id: "fb_6", contractId: "c_6", outcome: "won", notes: "Rapid turnaround commitment", department: "Canada Revenue Agency", category: "Document Processing", bidPrice: 28000, estimatedValue: 35000, createdAt: "2025-03-10T10:00:00Z" },
  { id: "fb_7", contractId: "c_7", outcome: "lost", notes: "Missing security clearance", department: "Department of National Defence", category: "IT Security", bidPrice: 200000, estimatedValue: 250000, createdAt: "2025-03-15T10:00:00Z" },
  { id: "fb_8", contractId: "c_8", outcome: "won", notes: "AI cost savings highlighted", department: "Transport Canada", category: "Data Analysis", bidPrice: 60000, estimatedValue: 80000, createdAt: "2025-04-01T10:00:00Z" },
];

for (const record of DEMO_FEEDBACK) {
  feedbackStore.set(record.id, record);
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `fb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/**
 * Record a contract outcome (won/lost) for feedback analysis.
 */
export async function recordOutcome(
  contractId: string,
  outcome: "won" | "lost",
  notes: string,
  meta?: { department?: string; category?: string; bidPrice?: number; estimatedValue?: number }
): Promise<void> {
  const record: FeedbackRecord = {
    id: generateId(),
    contractId,
    outcome,
    notes,
    department: meta?.department || "",
    category: meta?.category || "",
    bidPrice: meta?.bidPrice || 0,
    estimatedValue: meta?.estimatedValue || 0,
    createdAt: new Date().toISOString(),
  };

  feedbackStore.set(record.id, record);
}

/**
 * Aggregate win/loss statistics across all feedback records.
 */
export async function getWinRateStats(): Promise<{
  overall: { total: number; won: number; lost: number; winRate: number };
  byDepartment: Array<{ department: string; won: number; lost: number; winRate: number }>;
  byCategory: Array<{ category: string; won: number; lost: number; winRate: number }>;
}> {
  const records = Array.from(feedbackStore.values());

  // Overall
  const won = records.filter((r) => r.outcome === "won").length;
  const lost = records.filter((r) => r.outcome === "lost").length;
  const total = records.length;
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0;

  // By department
  const deptMap = new Map<string, { won: number; lost: number }>();
  for (const r of records) {
    if (!r.department) continue;
    const entry = deptMap.get(r.department) || { won: 0, lost: 0 };
    if (r.outcome === "won") entry.won++;
    else entry.lost++;
    deptMap.set(r.department, entry);
  }
  const byDepartment = Array.from(deptMap.entries()).map(([department, stats]) => ({
    department,
    won: stats.won,
    lost: stats.lost,
    winRate: Math.round((stats.won / (stats.won + stats.lost)) * 100),
  }));

  // By category
  const catMap = new Map<string, { won: number; lost: number }>();
  for (const r of records) {
    if (!r.category) continue;
    const entry = catMap.get(r.category) || { won: 0, lost: 0 };
    if (r.outcome === "won") entry.won++;
    else entry.lost++;
    catMap.set(r.category, entry);
  }
  const byCategory = Array.from(catMap.entries()).map(([category, stats]) => ({
    category,
    won: stats.won,
    lost: stats.lost,
    winRate: Math.round((stats.won / (stats.won + stats.lost)) * 100),
  }));

  return { overall: { total, won, lost, winRate }, byDepartment, byCategory };
}

/**
 * Returns scoring weight adjustments based on win/loss patterns.
 * Categories/departments where we lose more get downweighted.
 */
export async function getAdjustedWeights(): Promise<Record<string, number>> {
  const stats = await getWinRateStats();
  const weights: Record<string, number> = {};

  for (const dept of stats.byDepartment) {
    // Higher win rate -> higher weight (0.5 to 1.5 range)
    weights[`dept:${dept.department}`] = 0.5 + (dept.winRate / 100);
  }

  for (const cat of stats.byCategory) {
    weights[`cat:${cat.category}`] = 0.5 + (cat.winRate / 100);
  }

  return weights;
}

/**
 * Aggregates pricing intelligence from winning bids to inform future pricing.
 */
export async function getPricingIntelFromWins(): Promise<
  Array<{
    department: string;
    category: string;
    avgWinPrice: number;
    avgEstimate: number;
    priceRatio: number;
  }>
> {
  const records = Array.from(feedbackStore.values()).filter(
    (r) => r.outcome === "won" && r.bidPrice > 0 && r.estimatedValue > 0
  );

  // Group by department + category
  const groupMap = new Map<
    string,
    { department: string; category: string; prices: number[]; estimates: number[] }
  >();

  for (const r of records) {
    const key = `${r.department}||${r.category}`;
    const entry = groupMap.get(key) || {
      department: r.department,
      category: r.category,
      prices: [],
      estimates: [],
    };
    entry.prices.push(r.bidPrice);
    entry.estimates.push(r.estimatedValue);
    groupMap.set(key, entry);
  }

  return Array.from(groupMap.values()).map((g) => {
    const avgWinPrice = Math.round(
      g.prices.reduce((sum, p) => sum + p, 0) / g.prices.length
    );
    const avgEstimate = Math.round(
      g.estimates.reduce((sum, e) => sum + e, 0) / g.estimates.length
    );
    return {
      department: g.department,
      category: g.category,
      avgWinPrice,
      avgEstimate,
      priceRatio: avgEstimate > 0 ? Math.round((avgWinPrice / avgEstimate) * 100) / 100 : 0,
    };
  });
}
