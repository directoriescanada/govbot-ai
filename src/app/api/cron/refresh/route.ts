import { NextRequest, NextResponse } from "next/server";
import { CANADABUYS_ENDPOINTS } from "@/lib/constants";
import { parseCanadaBuysCSV, parseAwardNoticesCSV } from "@/lib/csv-parser";
import { parseMerxXML } from "@/lib/merx-parser";
import { fetchSamGovOpportunities, formatSamDate } from "@/lib/samgov-client";
import { classifyTender } from "@/lib/claude";
import { computeOpportunityScore } from "@/lib/scoring";
import { Tender } from "@/types/tender";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const MAX_CLASSIFY_PER_RUN = 20;
const CLASSIFY_DELAY_MS = 2000;

async function fetchWithRetry(url: string, retries = 3): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "User-Agent": "GovBot-AI/1.0 (Government Contract Intelligence Platform)",
          "Accept": "text/csv, application/json, text/plain, */*",
        },
      });
      if (res.ok) return res;
      console.warn(`Fetch attempt ${i + 1} failed: ${res.status} for ${url}`);
    } catch (err) {
      console.warn(`Fetch attempt ${i + 1} error:`, err);
    }
    if (i < retries - 1) await sleep(2000 * (i + 1));
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createServiceClient();
  const stats = {
    canadabuys: { fetched: 0, new: 0, classified: 0, updated: 0, awards: 0 },
    merx: { fetched: 0, new: 0, classified: 0, updated: 0 },
    samgov: { fetched: 0, new: 0, classified: 0, updated: 0 },
  };
  let totalClassified = 0;
  const errors: string[] = [];

  // ─── 1. CanadaBuys ─────────────────────────────────────────
  try {
    const csvResponse = await fetchWithRetry(CANADABUYS_ENDPOINTS.tenderNotices);
    if (csvResponse) {
      const csvText = await csvResponse.text();
      if (csvText && csvText.length >= 100) {
        const parsed = parseCanadaBuysCSV(csvText);
        stats.canadabuys.fetched = parsed.length;
        totalClassified = await processTenders(
          parsed, "canadabuys", supabase, totalClassified, stats.canadabuys, errors
        );
      } else {
        errors.push("CanadaBuys CSV too small");
      }
    } else {
      errors.push("CanadaBuys fetch failed after retries");
    }
  } catch (err) {
    errors.push(`CanadaBuys error: ${String(err)}`);
  }

  // Fetch award notices
  try {
    const awardsResponse = await fetchWithRetry(CANADABUYS_ENDPOINTS.awardNotices);
    if (awardsResponse) {
      const text = await awardsResponse.text();
      const awards = parseAwardNoticesCSV(text);
      for (const award of awards) {
        if (!award.externalId) continue;
        const { error } = await supabase.from("award_notices").upsert(
          {
            external_id: award.externalId.slice(0, 100),
            title: (award.title || "").slice(0, 1000),
            department: (award.department || "").slice(0, 500),
            award_date: award.awardDate || null,
            vendor_name: (award.vendorName || "").slice(0, 500),
            contract_value: award.contractValue || 0,
            category: (award.category || "SRV").slice(0, 20),
            gsin: (award.gsin || "").slice(0, 50),
            source: "canadabuys",
          },
          { onConflict: "external_id,source" }
        );
        if (!error) stats.canadabuys.awards++;
      }
    }
  } catch (err) {
    errors.push(`Awards error: ${String(err)}`);
  }

  // ─── 2. MERX ───────────────────────────────────────────────
  const merxFeedUrl = process.env.MERX_FEED_URL;
  if (merxFeedUrl) {
    try {
      const merxResponse = await fetchWithRetry(merxFeedUrl);
      if (merxResponse) {
        const merxText = await merxResponse.text();
        const contentType = merxResponse.headers.get("content-type") || "";

        let parsed: Partial<Tender>[] = [];
        if (contentType.includes("json")) {
          const jsonData = JSON.parse(merxText);
          const { parseMerxJSON } = await import("@/lib/merx-parser");
          parsed = parseMerxJSON(Array.isArray(jsonData) ? jsonData : jsonData.opportunities || []);
        } else {
          parsed = parseMerxXML(merxText);
        }

        stats.merx.fetched = parsed.length;
        totalClassified = await processTenders(
          parsed, "merx", supabase, totalClassified, stats.merx, errors
        );
      } else {
        errors.push("MERX feed fetch failed");
      }
    } catch (err) {
      errors.push(`MERX error: ${String(err)}`);
    }
  }

  // ─── 3. SAM.gov ────────────────────────────────────────────
  const samApiKey = process.env.SAM_GOV_API_KEY;
  if (samApiKey) {
    try {
      const { tenders: samTenders, total } = await fetchSamGovOpportunities({
        apiKey: samApiKey,
        postedFrom: formatSamDate(3), // Last 3 days
        limit: 50,
      });

      stats.samgov.fetched = samTenders.length;
      totalClassified = await processTenders(
        samTenders, "sam_gov", supabase, totalClassified, stats.samgov, errors
      );
    } catch (err) {
      errors.push(`SAM.gov error: ${String(err)}`);
    }
  }

  // ─── 4. Log the refresh ────────────────────────────────────
  const duration = Date.now() - startTime;
  const totalFetched = stats.canadabuys.fetched + stats.merx.fetched + stats.samgov.fetched;
  const totalNew = stats.canadabuys.new + stats.merx.new + stats.samgov.new;

  await supabase.from("refresh_log").insert({
    source: "multi",
    tenders_fetched: totalFetched,
    tenders_new: totalNew,
    tenders_classified: totalClassified,
    awards_fetched: stats.canadabuys.awards,
    duration_ms: duration,
    error: errors.length > 0 ? errors.join("; ") : null,
  });

  // ─── 5. Auto-trigger notifications if new tenders found ────
  if (totalNew > 0) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

      await fetch(`${appUrl}/api/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      });
    } catch (err) {
      console.warn("Notification trigger failed:", err);
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    sources: {
      canadabuys: stats.canadabuys,
      merx: merxFeedUrl ? stats.merx : "not configured",
      samgov: samApiKey ? stats.samgov : "not configured",
    },
    totalFetched,
    totalNew,
    totalClassified,
    durationMs: duration,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// ─── Shared Tender Processing ───────────────────────────────────

async function processTenders(
  tenders: Partial<Tender>[],
  source: string,
  supabase: ReturnType<typeof createServiceClient>,
  classifiedSoFar: number,
  stats: { new: number; classified: number; updated: number },
  errors: string[]
): Promise<number> {
  // STEP 1: Batch upsert all tenders without classification (fast)
  const validTenders = tenders.filter((t) => t.externalId && t.title);
  
  if (validTenders.length > 0) {
    const batch = validTenders.map((tender) => ({
      external_id: (tender.externalId || "").slice(0, 100),
      title: (tender.title || "").slice(0, 1000),
      description: (tender.description || "").slice(0, 10000),
      department: (tender.department || "").slice(0, 500),
      category: (tender.category || "SRV").slice(0, 20),
      gsin: (tender.gsin || "").slice(0, 50),
      closing_date: tender.closingDate || null,
      publication_date: tender.publicationDate || null,
      estimated_value: tender.estimatedValue || 0,
      solicitation_type: (tender.solicitationType || "RFP").slice(0, 50),
      region: (tender.region || "").slice(0, 200),
      trade_agreements: tender.tradeAgreements || [],
      ai_categories: [],
      ai_score: 0,
      competitor_count: 0,
      bid_complexity: "Medium",
      ai_fulfillment: null,
      source,
      source_url: (tender.sourceUrl || "").slice(0, 500),
      status: tender.status || "open",
      computed_score: 0,
    }));

    console.log(`Batch upserting ${batch.length} ${source} tenders...`);
    const { error, count } = await supabase
      .from("tenders")
      .upsert(batch, { onConflict: "external_id,source", count: "exact" });

    if (error) {
      errors.push(`${source} batch upsert: ${error.message}`);
    } else {
      stats.new = count || 0;
      console.log(`✓ Upserted ${count} ${source} tenders`);
    }
  }

  // STEP 2: Classify the oldest unclassified tenders (up to MAX_CLASSIFY_PER_RUN)
  let totalClassified = classifiedSoFar;
  if (totalClassified >= MAX_CLASSIFY_PER_RUN) {
    return totalClassified;
  }

  const remaining = MAX_CLASSIFY_PER_RUN - totalClassified;
  const { data: unclassified } = await supabase
    .from("tenders")
    .select("id, external_id, title, description, department, estimated_value, category")
    .eq("source", source)
    .eq("ai_score", 0)
    .order("created_at", { ascending: true })
    .limit(remaining);

  if (!unclassified || unclassified.length === 0) {
    return totalClassified;
  }

  console.log(`Classifying ${unclassified.length} ${source} tenders with AI...`);

  for (const tender of unclassified) {
    if (totalClassified >= MAX_CLASSIFY_PER_RUN) break;

    let classification;
    try {
      classification = await classifyTender(
        tender.title || "",
        tender.description || "",
        tender.department || "",
        tender.estimated_value || 0,
        tender.category || "SRV"
      );
      totalClassified++;
      stats.classified++;

      if (totalClassified < MAX_CLASSIFY_PER_RUN) {
        await sleep(CLASSIFY_DELAY_MS);
      }
    } catch (err) {
      const errMsg = String(err);
      if (errMsg.includes("429") || errMsg.includes("rate")) {
        errors.push(`Claude rate limit hit during ${source}`);
        return totalClassified;
      }
      classification = {
        aiCategories: [],
        aiScore: 0,
        bidComplexity: "Medium" as const,
        competitorEstimate: 10,
        fulfillmentPlan: null,
      };
    }

    const fullTender: Partial<Tender> = {
      externalId: tender.external_id,
      title: tender.title,
      description: tender.description,
      department: tender.department,
      estimatedValue: tender.estimated_value,
      category: tender.category,
      aiCategories: classification.aiCategories,
      aiScore: classification.aiScore,
      bidComplexity: classification.bidComplexity,
      competitorCount: classification.competitorEstimate,
      aiFulfillment: classification.fulfillmentPlan,
    };

    const score = computeOpportunityScore(fullTender as Tender);

    const { error } = await supabase
      .from("tenders")
      .update({
        ai_categories: classification.aiCategories || [],
        ai_score: classification.aiScore || 0,
        competitor_count: classification.competitorEstimate || 0,
        bid_complexity: classification.bidComplexity || "Medium",
        ai_fulfillment: classification.fulfillmentPlan,
        computed_score: score,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tender.id);

    if (error) {
      errors.push(`${source} classification update: ${error.message}`);
    }
  }

  return totalClassified;
}
