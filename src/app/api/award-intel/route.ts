import { NextRequest, NextResponse } from "next/server";
import {
  getIntelSummary,
  topVendors,
  avgAwardByDepartment,
  avgAwardByCategory,
  lowCompetitionDepts,
  recommendPrice,
  listAwards,
} from "@/lib/award-intelligence";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("summary") === "true") {
      const summary = getIntelSummary();
      return NextResponse.json(summary);
    }

    if (searchParams.get("vendors") === "true") {
      const limit = parseInt(searchParams.get("limit") || "10", 10);
      const vendors = topVendors(limit);
      return NextResponse.json(vendors);
    }

    if (searchParams.get("departments") === "true") {
      const departments = avgAwardByDepartment();
      return NextResponse.json(departments);
    }

    if (searchParams.get("categories") === "true") {
      const categories = avgAwardByCategory();
      return NextResponse.json(categories);
    }

    if (searchParams.get("competition") === "true") {
      const competition = lowCompetitionDepts();
      return NextResponse.json(competition);
    }

    if (searchParams.get("recommend") === "true") {
      const department = searchParams.get("department") || "";
      const category = searchParams.get("category") || "";
      const value = parseFloat(searchParams.get("value") || "0");

      const recommendation = recommendPrice({
        department,
        category,
        estimatedValue: value,
      });
      return NextResponse.json(recommendation);
    }

    // Default: return summary + awards
    const summary = getIntelSummary();
    const awards = listAwards();

    return NextResponse.json({ summary, awards });
  } catch (error) {
    console.error("Award intel GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch award intelligence data" },
      { status: 500 }
    );
  }
}
