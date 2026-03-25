import { NextRequest, NextResponse } from "next/server";
import { getBidQueueItem } from "@/lib/auto-bid";
import { recommendPrice } from "@/lib/award-intelligence";
import { analyzeBidStrength } from "@/lib/claude";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bidId } = body;

    if (!bidId) {
      return NextResponse.json(
        { error: "bidId is required" },
        { status: 400 }
      );
    }

    const item = await getBidQueueItem(bidId);
    if (!item) {
      return NextResponse.json(
        { error: "Bid queue item not found" },
        { status: 404 }
      );
    }

    if (!item.bidDraft) {
      return NextResponse.json(
        { error: "Bid draft has not been generated yet" },
        { status: 400 }
      );
    }

    // Get award intelligence for pricing context
    const awardIntel = recommendPrice({
      department: item.department,
      category: item.category || "",
      estimatedValue: item.estimatedValue,
    });

    const analysis = await analyzeBidStrength({
      tenderTitle: item.tenderTitle,
      department: item.department,
      estimatedValue: item.estimatedValue,
      bidDraft: item.bidDraft,
      awardIntel: {
        recommendedPrice: awardIntel.recommendedBidPrice,
        confidence: awardIntel.confidence,
      },
    });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Bid strength analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze bid strength" },
      { status: 500 }
    );
  }
}
