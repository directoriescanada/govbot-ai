import { NextRequest, NextResponse } from "next/server";
import { MOCK_TENDERS, MOCK_AWARDS } from "@/lib/mock-data";
import { computeOpportunityScore, formatCurrency, daysUntil } from "@/lib/scoring";
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const rateCheck = checkRateLimit(request, "default");
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.remaining);

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "tenders";
  const format = searchParams.get("format") || "csv";

  if (format !== "csv") {
    return NextResponse.json({ error: "Only CSV export is currently supported" }, { status: 400 });
  }

  let csv = "";
  let filename = "";

  if (type === "tenders") {
    const tenders = MOCK_TENDERS.map((t) => ({
      ...t,
      computedScore: computeOpportunityScore(t),
    })).sort((a, b) => (b.computedScore || 0) - (a.computedScore || 0));

    csv = "ID,Title,Department,Score,AI Score,Value,Days Left,Categories,Complexity,Source,Status\n";
    csv += tenders
      .map((t) =>
        [
          t.externalId,
          `"${t.title.replace(/"/g, '""')}"`,
          `"${t.department.replace(/"/g, '""')}"`,
          t.computedScore,
          t.aiScore,
          t.estimatedValue,
          daysUntil(t.closingDate),
          `"${t.aiCategories.join(", ")}"`,
          t.bidComplexity,
          t.source,
          t.status,
        ].join(",")
      )
      .join("\n");
    filename = `govbot-tenders-${new Date().toISOString().split("T")[0]}.csv`;
  } else if (type === "awards") {
    csv = "Title,Department,Vendor,Value,Date,Category\n";
    csv += MOCK_AWARDS.map((a) =>
      [
        `"${a.title.replace(/"/g, '""')}"`,
        `"${a.department.replace(/"/g, '""')}"`,
        `"${a.vendorName.replace(/"/g, '""')}"`,
        a.contractValue,
        a.awardDate,
        a.category,
      ].join(",")
    ).join("\n");
    filename = `govbot-awards-${new Date().toISOString().split("T")[0]}.csv`;
  } else if (type === "analytics") {
    // Vendor summary
    const vendorMap: Record<string, { count: number; total: number }> = {};
    MOCK_AWARDS.forEach((a) => {
      if (!vendorMap[a.vendorName]) vendorMap[a.vendorName] = { count: 0, total: 0 };
      vendorMap[a.vendorName].count++;
      vendorMap[a.vendorName].total += a.contractValue;
    });

    csv = "Vendor,Awards,Total Value,Avg Value\n";
    csv += Object.entries(vendorMap)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([name, data]) =>
        [
          `"${name.replace(/"/g, '""')}"`,
          data.count,
          data.total,
          Math.round(data.total / data.count),
        ].join(",")
      )
      .join("\n");
    filename = `govbot-analytics-${new Date().toISOString().split("T")[0]}.csv`;
  } else {
    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
