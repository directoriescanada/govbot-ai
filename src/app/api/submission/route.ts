// ═══════════════════════════════════════════════════════════════════
// POST /api/submission — Generate a submission-ready bid package
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { generateSubmissionPackage } from "@/lib/claude";
import { Tender } from "@/types/tender";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const tender = await req.json() as Tender;

    if (!tender?.id || !tender?.title) {
      return NextResponse.json({ error: "Invalid tender object" }, { status: 400 });
    }

    const pkg = await generateSubmissionPackage(tender);
    return NextResponse.json({ package: pkg });
  } catch (err) {
    console.error("Submission package error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
