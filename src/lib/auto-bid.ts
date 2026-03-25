import { Tender } from "@/types/tender";
import { getConfigSection } from "@/lib/config";
import { recommendPrice } from "@/lib/award-intelligence";
import { useSupabase } from "@/lib/db";
async function getServiceClient() {
  const { createServiceClient } = await import("@/lib/supabase/server");
  return createServiceClient();
}

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
// In-memory store (demo-mode fallback)
// ---------------------------------------------------------------------------

const bidQueue: Map<string, BidQueueItem> = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `bid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_BID_RATIO = 0.82;

/** Map a Supabase row (snake_case) to a BidQueueItem (camelCase). */
function rowToItem(row: Record<string, unknown>): BidQueueItem {
  return {
    id: row.id as string,
    tenderId: row.tender_id as string,
    tenderTitle: row.tender_title as string,
    department: (row.department as string) ?? "",
    category: (row.category as string) ?? "",
    estimatedValue: Number(row.estimated_value ?? 0),
    closingDate: row.closing_date ? String(row.closing_date) : "",
    aiScore: Number(row.ai_score ?? 0),
    bidPrice: Number(row.bid_price ?? 0),
    marginPercent: Number(row.margin_percent ?? 0),
    status: row.status as BidQueueStatus,
    bidDraft: (row.bid_draft as BidQueueItem["bidDraft"]) ?? null,
    blockers: (row.blockers as BidQueueItem["blockers"]) ?? [],
    createdAt: row.created_at ? String(row.created_at) : "",
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    exportedAt: row.exported_at ? String(row.exported_at) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Add a tender to the auto-bid queue.
 * Called by cron when score >= 90 and no hard blockers.
 */
export async function queueForAutoBid(tender: Tender): Promise<BidQueueItem | null> {
  const biddingCfg = await getConfigSection("bidding");

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

  // Use cost breakdown from config to estimate delivery cost and margin
  const costBreakdown = biddingCfg.costBreakdown;
  const deliveryCostRatio = costBreakdown.aiCosts + costBreakdown.humanCosts + costBreakdown.infrastructure + costBreakdown.overhead + costBreakdown.qa;
  const estimatedDeliveryCost = bidPrice * Math.min(deliveryCostRatio, 1);
  const marginPercent =
    bidPrice > 0
      ? Math.round(((bidPrice - estimatedDeliveryCost) / bidPrice) * 10000) / 100
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

  if (!useSupabase()) {
    // Check weekly auto-bid limit (in-memory)
    const maxPerWeek = biddingCfg.maxAutoBidsPerWeek;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thisWeekCount = Array.from(bidQueue.values()).filter(
      (i) => i.createdAt >= oneWeekAgo
    ).length;
    if (thisWeekCount >= maxPerWeek) return null;

    bidQueue.set(id, item);
    return item;
  }

  // --- Supabase path ---
  const sb = await getServiceClient();

  // Check weekly limit
  const maxPerWeek = biddingCfg.maxAutoBidsPerWeek;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await sb
    .from("bid_queue")
    .select("id", { count: "exact", head: true })
    .gte("created_at", oneWeekAgo);
  if ((count ?? 0) >= maxPerWeek) return null;

  const { data, error } = await sb
    .from("bid_queue")
    .insert({
      id: item.id,
      tender_id: item.tenderId,
      tender_title: item.tenderTitle,
      department: item.department,
      category: item.category,
      estimated_value: item.estimatedValue,
      closing_date: item.closingDate || null,
      ai_score: item.aiScore,
      bid_price: item.bidPrice,
      margin_percent: item.marginPercent,
      status: item.status,
      bid_draft: item.bidDraft,
      blockers: item.blockers,
      created_at: item.createdAt,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase bid_queue insert error:", error);
    return null;
  }
  return rowToItem(data);
}

/**
 * Generate a full bid draft for an existing queue item using Claude.
 */
export async function generateAutoBidDraft(itemId: string): Promise<BidQueueItem | null> {
  let item: BidQueueItem | null | undefined;

  if (!useSupabase()) {
    item = bidQueue.get(itemId);
  } else {
    const sb = await getServiceClient();
    const { data } = await sb.from("bid_queue").select("*").eq("id", itemId).single();
    item = data ? rowToItem(data) : null;
  }
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
export async function attachBidDraft(
  id: string,
  bidDraft: BidQueueItem["bidDraft"]
): Promise<BidQueueItem | null> {
  if (!useSupabase()) {
    const item = bidQueue.get(id);
    if (!item) return null;
    item.bidDraft = bidDraft;
    return item;
  }

  const sb = await getServiceClient();
  const { data, error } = await sb
    .from("bid_queue")
    .update({ bid_draft: bidDraft as unknown as Record<string, unknown> })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return null;
  return rowToItem(data);
}

/**
 * Transition a queue item to a new status.
 */
export async function updateBidStatus(
  id: string,
  status: BidQueueStatus
): Promise<BidQueueItem | null> {
  if (!useSupabase()) {
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

  const patch: Record<string, unknown> = { status };
  if (status === "reviewing" || status === "approved") {
    patch.reviewed_at = new Date().toISOString();
  }
  if (status === "exported") {
    patch.exported_at = new Date().toISOString();
  }

  const sb = await getServiceClient();
  const { data, error } = await sb
    .from("bid_queue")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return null;
  return rowToItem(data);
}

/**
 * List queue items, optionally filtered by status.
 */
export async function listBidQueue(filter?: {
  status?: BidQueueStatus;
}): Promise<BidQueueItem[]> {
  if (!useSupabase()) {
    const items = Array.from(bidQueue.values());
    if (filter?.status) {
      return items.filter((i) => i.status === filter.status);
    }
    return items;
  }

  const sb = await getServiceClient();
  let query = sb.from("bid_queue").select("*");
  if (filter?.status) {
    query = query.eq("status", filter.status);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToItem);
}

/**
 * Aggregate stats for the bid queue.
 */
export async function getBidQueueStats(): Promise<{
  total: number;
  awaitingReview: number;
  approved: number;
  exported: number;
  submitted: number;
  totalBidValue: number;
}> {
  if (!useSupabase()) {
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

  const sb = await getServiceClient();
  const { data, error } = await sb.from("bid_queue").select("status, bid_price");
  if (error || !data) {
    return { total: 0, awaitingReview: 0, approved: 0, exported: 0, submitted: 0, totalBidValue: 0 };
  }

  let awaitingReview = 0;
  let approved = 0;
  let exported = 0;
  let submitted = 0;
  let totalBidValue = 0;

  for (const row of data) {
    totalBidValue += Number(row.bid_price ?? 0);
    switch (row.status) {
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
    total: data.length,
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
export async function getBidQueueItem(id: string): Promise<BidQueueItem | undefined> {
  if (!useSupabase()) {
    return bidQueue.get(id);
  }

  const sb = await getServiceClient();
  const { data, error } = await sb.from("bid_queue").select("*").eq("id", id).single();
  if (error || !data) return undefined;
  return rowToItem(data);
}

/**
 * Check whether a tender has already been queued.
 */
export async function isTenderQueued(tenderId: string): Promise<boolean> {
  if (!useSupabase()) {
    for (const item of bidQueue.values()) {
      if (item.tenderId === tenderId) return true;
    }
    return false;
  }

  const sb = await getServiceClient();
  const { count } = await sb
    .from("bid_queue")
    .select("id", { count: "exact", head: true })
    .eq("tender_id", tenderId);
  return (count ?? 0) > 0;
}
