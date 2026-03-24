import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  checkRateLimit,
  rateLimitResponse,
  validateString,
} from "@/lib/api-utils";

const VALID_STAGES = ["interested", "qualifying", "bidding", "submitted", "won", "lost", "no_bid"];

const USE_MOCK = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === "your_supabase_url";

// GET — list saved tenders for the current user
export async function GET(request: NextRequest) {
  if (USE_MOCK) {
    return NextResponse.json({ data: [], total: 0 });
  }

  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const rateCheck = checkRateLimit(request, "tenders");
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.remaining);

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage") || "all";

    let query = supabase
      .from("saved_tenders")
      .select("*, tenders(*)", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (stage !== "all" && VALID_STAGES.includes(stage)) {
      query = query.eq("pipeline_stage", stage);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (error) {
    console.error("Saved tenders error:", error);
    return NextResponse.json({ error: "Failed to fetch saved tenders" }, { status: 500 });
  }
}

// POST — save/bookmark a tender
export async function POST(request: NextRequest) {
  if (USE_MOCK) {
    return NextResponse.json({ success: true, message: "Demo mode — connect Supabase to save tenders" });
  }

  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const rateCheck = checkRateLimit(request, "tenders");
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.remaining);

  try {
    const body = await request.json();
    const tenderId = validateString(body.tenderId, "tenderId", { required: true, maxLength: 100 });
    if (!tenderId.valid) return NextResponse.json({ error: tenderId.error }, { status: 400 });

    const stage = body.stage && VALID_STAGES.includes(body.stage) ? body.stage : "interested";
    const notes = validateString(body.notes, "notes", { maxLength: 2000 });

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase.from("saved_tenders").upsert(
      {
        user_id: user.id,
        tender_id: tenderId.value,
        pipeline_stage: stage,
        notes: notes.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tender_id" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Save tender error:", error);
    return NextResponse.json({ error: "Failed to save tender" }, { status: 500 });
  }
}

// DELETE — remove a saved tender
export async function DELETE(request: NextRequest) {
  if (USE_MOCK) {
    return NextResponse.json({ success: true });
  }

  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const tenderId = searchParams.get("tenderId");
    if (!tenderId) return NextResponse.json({ error: "tenderId required" }, { status: 400 });

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await supabase
      .from("saved_tenders")
      .delete()
      .eq("user_id", user.id)
      .eq("tender_id", tenderId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete saved tender error:", error);
    return NextResponse.json({ error: "Failed to remove saved tender" }, { status: 500 });
  }
}
