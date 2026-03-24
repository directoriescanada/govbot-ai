import { Tender } from "@/types/tender";
import { getConfigSection } from "@/lib/config";
import { recommendPrice } from "@/lib/award-intelligence";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BidQueueStatus =
  | "auto_drafted"
  | "reviewing"
  | "approved"
  | "exported"
  | "submitted"
  | "skipped";

export interface BidQueueItem {
  id: string;
  tenderId: string;
  tenderTitle: string;
  department: string;
  category: string;
  estimatedValue: number;
  closingDate: string;
  aiScore: number;
  bidPrice: number;
  marginPercent: number;
  status: BidQueueStatus;
  bidDraft: {
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
  } | null;
  blockers: Array<{ type: string; label: string; severity: string }>;
  createdAt: string;
  reviewedAt?: string;
  exportedAt?: string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const bidQueue: Map<string, BidQueueItem> = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `bid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_BID_RATIO = 0.82;
const ESTIMATED_AI_COST_RATIO = 0.15;

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Add a tender to the auto-bid queue.
 * Called by cron when score >= 90 and no hard blockers.
 */
export function queueForAutoBid(tender: Tender): BidQueueItem | null {
  const biddingCfg = getConfigSection("bidding");

  // Check weekly auto-bid limit
  const maxPerWeek = biddingCfg.maxAutoBidsPerWeek;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thisWeekCount = Array.from(bidQueue.values()).filter(
    (item) => item.createdAt >= oneWeekAgo
  ).length;
  if (thisWeekCount >= maxPerWeek) {
    return null;
  }

  const id = generateId();
  const estimatedValue = (tender as any).estimatedValue ?? 0;

  // Use award intelligence for smarter pricing, fall back to config default
  const recommendation = recommendPrice({
    department: (tender as any).department ?? "",
    category: (tender as any).category ?? "",
    estimatedValue,
  });
  const useSmartPrice = recommendation.confidence === "high" || recommendation.confidence === "medium";
  const bidRatio = useSmartPrice
    ? recommendation.bidAsPercentOfEstimate / 100
    : biddingCfg.defaultBidPercent / 100;
  const bidPrice = Math.round(estimatedValue * bidRatio * 100) / 100;

  const estimatedAICost = bidPrice * ESTIMATED_AI_COST_RATIO;
  const marginPercent =
    bidPrice > 0
      ? Math.round(((bidPrice - estimatedAICost) / bidPrice) * 10000) / 100
      : 0;

  const item: BidQueueItem = {
    id,
    tenderId: tender.id,
    tenderTitle: tender.title,
    department: (tender as any).department ?? "",
    category: (tender as any).category ?? "",
    estimatedValue,
    closingDate: (tender as any).closingDate ?? "",
    aiScore: (tender as any).aiScore ?? 0,
    bidPrice,
    marginPercent,
    status: "auto_drafted",
    bidDraft: null,
    blockers: Array.isArray((tender as any).blockers)
      ? (tender as any).blockers
      : [],
    createdAt: new Date().toISOString(),
  };

  bidQueue.set(id, item);
  return item;
}

/**
 * Generate a full bid draft for an existing queue item using Claude.
 */
export async function generateAutoBidDraft(itemId: string): Promise<BidQueueItem | null> {
  const item = bidQueue.get(itemId);
  if (!item) return null;

  const { generateBidResponse } = await import("@/lib/claude");
  const result = await generateBidResponse(
    item.tenderTitle,
    "", // description not stored on queue item
    item.department,
    "", // requirements
    item.estimatedValue
  );

  return attachBidDraft(itemId, {
    complianceMatrix: result.complianceMatrix,
    proposalSections: result.proposalSections,
    pricingModel: result.pricingModel,
  });
}

/**
 * Attach a generated bid draft to an existing queue item.
 */
export function attachBidDraft(
  id: string,
  bidDraft: BidQueueItem["bidDraft"]
): BidQueueItem | null {
  const item = bidQueue.get(id);
  if (!item) return null;

  item.bidDraft = bidDraft;
  return item;
}

/**
 * Transition a queue item to a new status.
 */
export function updateBidStatus(
  id: string,
  status: BidQueueStatus
): BidQueueItem | null {
  const item = bidQueue.get(id);
  if (!item) return null;

  item.status = status;

  if (status === "reviewing" || status === "approved") {
    item.reviewedAt = new Date().toISOString();
  }
  if (status === "exported") {
    item.exportedAt = new Date().toISOString();
  }

  return item;
}

/**
 * List queue items, optionally filtered by status.
 */
export function listBidQueue(filter?: {
  status?: BidQueueStatus;
}): BidQueueItem[] {
  const items = Array.from(bidQueue.values());
  if (filter?.status) {
    return items.filter((i) => i.status === filter.status);
  }
  return items;
}

/**
 * Aggregate stats for the bid queue.
 */
export function getBidQueueStats(): {
  total: number;
  awaitingReview: number;
  approved: number;
  exported: number;
  submitted: number;
  totalBidValue: number;
} {
  let awaitingReview = 0;
  let approved = 0;
  let exported = 0;
  let submitted = 0;
  let totalBidValue = 0;

  for (const item of bidQueue.values()) {
    totalBidValue += item.bidPrice;
    switch (item.status) {
      case "auto_drafted":
      case "reviewing":
        awaitingReview++;
        break;
      case "approved":
        approved++;
        break;
      case "exported":
        exported++;
        break;
      case "submitted":
        submitted++;
        break;
    }
  }

  return {
    total: bidQueue.size,
    awaitingReview,
    approved,
    exported,
    submitted,
    totalBidValue: Math.round(totalBidValue * 100) / 100,
  };
}

/**
 * Retrieve a single queue item by id.
 */
export function getBidQueueItem(id: string): BidQueueItem | undefined {
  return bidQueue.get(id);
}

/**
 * Check whether a tender has already been queued.
 */
export function isTenderQueued(tenderId: string): boolean {
  for (const item of bidQueue.values()) {
    if (item.tenderId === tenderId) return true;
  }
  return false;
}
