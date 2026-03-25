// ═══════════════════════════════════════════════════════════════════
// POST /api/fulfill  — Run the AI fulfillment agent for a contract
// GET  /api/fulfill  — List all fulfillment jobs
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { runFulfillmentAgent, FulfillmentInput } from "@/lib/claude";
import { createJob, getJob, updateJob, listJobs } from "@/lib/fulfillment";
import { AICategory } from "@/types/tender";

export const maxDuration = 120;

export async function GET() {
  const jobs = await listJobs();
  return NextResponse.json({ data: jobs, total: jobs.length });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      tenderId,
      tenderTitle,
      department,
      category,
      contractValue,
      brief,
      inputContent,
    } = body as {
      tenderId: string;
      tenderTitle: string;
      department: string;
      category: AICategory;
      contractValue: number;
      brief: string;
      inputContent?: string;
    };

    if (!tenderId || !tenderTitle || !category || !brief) {
      return NextResponse.json(
        { error: "Missing required fields: tenderId, tenderTitle, category, brief" },
        { status: 400 }
      );
    }

    // Create job record
    const job = await createJob({
      tenderId,
      tenderTitle,
      department: department || "",
      category,
      brief,
      inputContent: inputContent || "",
      reviewNotes: "",
      estimatedAICost: 0,
    });

    // Mark as running
    await updateJob(job.id, { status: "running", agentLog: ["Agent started..."] });

    // Run the fulfillment agent
    const input: FulfillmentInput = {
      category,
      tenderTitle,
      department: department || "",
      contractValue: contractValue || 0,
      brief,
      inputContent,
    };

    const result = await runFulfillmentAgent(input);

    // Save output
    const completed = await updateJob(job.id, {
      status: "review",
      output: result.deliverable,
      estimatedAICost: result.estimatedAICost,
      agentLog: [
        "Agent started...",
        `Model: claude-sonnet-4-20250514`,
        `Category: ${category}`,
        `Output: ${result.wordCount} words`,
        `Quality estimate: ${result.estimatedQuality}/100`,
        `Estimated API cost: $${result.estimatedAICost}`,
        "Status: Ready for review",
      ],
      completedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      job: completed,
      output: result,
    });
  } catch (err) {
    console.error("Fulfillment agent error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fulfillment failed" },
      { status: 500 }
    );
  }
}

// PATCH /api/fulfill — Update job (review notes, status)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...patch } = body as { id: string } & Partial<Parameters<typeof updateJob>[1]>;

    if (!id) {
      return NextResponse.json({ error: "Missing job id" }, { status: 400 });
    }

    const existing = await getJob(id);
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const updated = await updateJob(id, patch);
    return NextResponse.json({ job: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
