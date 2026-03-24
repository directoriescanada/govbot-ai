import { NextRequest, NextResponse } from "next/server";
import { MOCK_TENDERS } from "@/lib/mock-data";
import {
  checkRateLimit,
  rateLimitResponse,
  sanitizeSearchQuery,
  validateNumber,
} from "@/lib/api-utils";

const USE_MOCK = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === "your_supabase_url";

export async function GET(request: NextRequest) {
  // Rate limit (no auth required for reading tenders)
  const rateCheck = checkRateLimit(request, "tenders");
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.remaining);

  const { searchParams } = new URL(request.url);

  const rawSearch = searchParams.get("search") || "";
  const search = sanitizeSearchQuery(rawSearch);
  const category = searchParams.get("category") || "ALL";
  const sortBy = ["score", "value", "deadline", "ai"].includes(searchParams.get("sort") || "")
    ? searchParams.get("sort")!
    : "score";
  const minScore = validateNumber(searchParams.get("minScore"), "minScore", { min: 0, max: 100, defaultValue: 0 }).value;
  const source = searchParams.get("source") || "all";
  const limit = validateNumber(searchParams.get("limit"), "limit", { min: 1, max: 100, defaultValue: 50 }).value;
  const offset = validateNumber(searchParams.get("offset"), "offset", { min: 0, max: 10000, defaultValue: 0 }).value;

  if (USE_MOCK) {
    let results = [...MOCK_TENDERS];

    if (category !== "ALL") {
      results = results.filter((t) => t.aiCategories.includes(category as never));
    }
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.externalId.toLowerCase().includes(q)
      );
    }
    if (minScore > 0) {
      results = results.filter((t) => (t.computedScore || 0) >= minScore);
    }
    if (source !== "all") {
      results = results.filter((t) => t.source === source);
    }

    switch (sortBy) {
      case "score":
        results.sort((a, b) => (b.computedScore || 0) - (a.computedScore || 0));
        break;
      case "value":
        results.sort((a, b) => b.estimatedValue - a.estimatedValue);
        break;
      case "deadline":
        results.sort((a, b) => new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime());
        break;
      case "ai":
        results.sort((a, b) => b.aiScore - a.aiScore);
        break;
    }

    const total = results.length;
    results = results.slice(offset, offset + limit);

    return NextResponse.json({ data: results, total, offset, limit });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    let query = supabase.from("tenders").select("*", { count: "exact" });

    if (category !== "ALL") {
      query = query.contains("ai_categories", [category]);
    }
    if (search) {
      // Use parameterized ilike — no string interpolation
      query = query.or(
        `title.ilike.%${search}%,department.ilike.%${search}%,external_id.ilike.%${search}%`
      );
    }
    if (minScore > 0) {
      query = query.gte("computed_score", minScore);
    }
    if (source !== "all") {
      query = query.eq("source", source);
    }

    switch (sortBy) {
      case "score":
        query = query.order("computed_score", { ascending: false });
        break;
      case "value":
        query = query.order("estimated_value", { ascending: false });
        break;
      case "deadline":
        query = query.order("closing_date", { ascending: true });
        break;
      case "ai":
        query = query.order("ai_score", { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenders = (data || []).map((row: any) => ({
      id: row.id,
      externalId: row.external_id,
      title: row.title,
      description: row.description,
      department: row.department,
      category: row.category,
      gsin: row.gsin,
      closingDate: row.closing_date,
      publicationDate: row.publication_date,
      estimatedValue: row.estimated_value,
      solicitationType: row.solicitation_type,
      region: row.region,
      tradeAgreements: row.trade_agreements,
      aiCategories: row.ai_categories,
      aiScore: row.ai_score,
      competitorCount: row.competitor_count,
      bidComplexity: row.bid_complexity,
      aiFulfillment: row.ai_fulfillment,
      source: row.source,
      sourceUrl: row.source_url,
      status: row.status,
      computedScore: row.computed_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ data: tenders, total: count || 0, offset, limit });
  } catch (error) {
    console.error("Tenders API error:", error);
    return NextResponse.json({ error: "Failed to fetch tenders" }, { status: 500 });
  }
}
