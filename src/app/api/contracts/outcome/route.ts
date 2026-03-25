import { NextRequest, NextResponse } from "next/server";
import { recordOutcome, getWinRateStats } from "@/lib/feedback-loop";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractId, outcome, notes, department, category, bidPrice, estimatedValue } = body;

    if (!contractId || !outcome) {
      return NextResponse.json(
        { error: "contractId and outcome are required" },
        { status: 400 }
      );
    }

    if (outcome !== "won" && outcome !== "lost") {
      return NextResponse.json(
        { error: "outcome must be 'won' or 'lost'" },
        { status: 400 }
      );
    }

    await recordOutcome(contractId, outcome, notes || "", {
      department,
      category,
      bidPrice,
      estimatedValue,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Record outcome error:", error);
    return NextResponse.json(
      { error: "Failed to record outcome" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const stats = await getWinRateStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Get win rate stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch win rate stats" },
      { status: 500 }
    );
  }
}
