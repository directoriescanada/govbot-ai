import { NextRequest, NextResponse } from "next/server";
import { getCompetitorIntel } from "@/lib/award-intelligence";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department") || "";
    const category = searchParams.get("category") || "";
    const estimatedValue = parseFloat(searchParams.get("estimatedValue") || "0");

    const intel = getCompetitorIntel({
      department,
      category,
      estimatedValue,
    });

    return NextResponse.json(intel);
  } catch (error) {
    console.error("Competitor intel error:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitor intelligence" },
      { status: 500 }
    );
  }
}
