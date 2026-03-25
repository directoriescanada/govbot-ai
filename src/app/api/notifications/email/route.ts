import { NextRequest, NextResponse } from "next/server";
import { sendOpportunityAlert } from "@/lib/email";
import { getConfig } from "@/lib/config";

/**
 * POST /api/notifications/email
 *
 * Triggers an email alert for a specific tender. Expects a JSON body with:
 *   - to: string (recipient email, optional — falls back to config)
 *   - tender: { id, title, department, estimatedValue, closingDate, computedScore, aiScore }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tender } = body;

    if (!tender || !tender.title) {
      return NextResponse.json(
        { error: "Missing tender data in request body" },
        { status: 400 }
      );
    }

    // Determine recipient: explicit `to` field, or fall back to config email
    let to: string = body.to || "";
    if (!to) {
      const config = await getConfig();
      to = config.alerts.emailAddress || config.company.contactEmail || "";
    }

    if (!to) {
      return NextResponse.json(
        { error: "No recipient email configured. Set alerts.emailAddress in config." },
        { status: 400 }
      );
    }

    const sent = await sendOpportunityAlert({ to, tender });

    if (!sent) {
      return NextResponse.json(
        { error: "Email send failed — check RESEND_API_KEY and server logs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, to });
  } catch (error) {
    console.error("Email notification route error:", error);
    return NextResponse.json(
      { error: "Failed to send email notification" },
      { status: 500 }
    );
  }
}
