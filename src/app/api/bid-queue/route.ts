import { NextRequest, NextResponse } from "next/server";
import { listBidQueue, getBidQueueStats } from "@/lib/auto-bid";
import { queueForAutoBid, isTenderQueued } from "@/lib/auto-bid";
import { updateBidStatus, attachBidDraft } from "@/lib/auto-bid";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("stats") === "true") {
      const stats = await getBidQueueStats();
      return NextResponse.json(stats);
    }

    const status = (searchParams.get("status") || undefined) as import("@/lib/auto-bid").BidQueueStatus | undefined;
    const items = await listBidQueue(status ? { status } : undefined);

    return NextResponse.json(items);
  } catch (error) {
    console.error("Bid queue GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bid queue" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tender = await request.json();

    if (!tender || !tender.id) {
      return NextResponse.json(
        { error: "Invalid tender object. Must include an id." },
        { status: 400 }
      );
    }

    const alreadyQueued = await isTenderQueued(tender.id);
    if (alreadyQueued) {
      return NextResponse.json(
        { error: "Tender is already queued for auto-bid" },
        { status: 409 }
      );
    }

    const result = await queueForAutoBid(tender);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Bid queue POST error:", error);
    return NextResponse.json(
      { error: "Failed to queue tender for auto-bid" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    if (body.bidDraft) {
      const result = await attachBidDraft(body.id, body.bidDraft);
      return NextResponse.json(result);
    }

    if (body.status) {
      const result = await updateBidStatus(body.id, body.status);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Must provide either status or bidDraft to update" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Bid queue PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update bid queue item" },
      { status: 500 }
    );
  }
}
