import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = createServiceClient();

    // Get all users with alerts enabled
    const { data: prefs } = await supabase
      .from("alert_preferences")
      .select("user_id, min_score, categories, email_enabled, slack_webhook")
      .eq("email_enabled", true);

    if (!prefs || prefs.length === 0) {
      return NextResponse.json({ message: "No alert subscribers", sent: 0 });
    }

    // Get recent high-scoring tenders (added in last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: newTenders } = await supabase
      .from("tenders")
      .select("*")
      .gte("created_at", twoHoursAgo)
      .gte("computed_score", 60)
      .order("computed_score", { ascending: false })
      .limit(20);

    if (!newTenders || newTenders.length === 0) {
      return NextResponse.json({ message: "No new high-scoring tenders", sent: 0 });
    }

    let emailsSent = 0;
    let slackSent = 0;

    for (const pref of prefs) {
      const minScore = pref.min_score || 70;
      const categories = pref.categories || [];

      // Filter tenders matching user preferences
      const matching = newTenders.filter((t) => {
        if (t.computed_score < minScore) return false;
        if (categories.length > 0) {
          const tCats = t.ai_categories || [];
          if (!categories.some((c: string) => tCats.includes(c))) return false;
        }
        return true;
      });

      if (matching.length === 0) continue;

      // Get user email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, company_name")
        .eq("id", pref.user_id)
        .single();

      if (!profile?.email) continue;

      // Send email via Resend
      const tenderRows = matching
        .map((t) => {
          const val = t.estimated_value
            ? `$${(t.estimated_value / 1000).toFixed(0)}K`
            : "TBD";
          return `<tr>
            <td style="padding:8px;border-bottom:1px solid #333;">${t.title}</td>
            <td style="padding:8px;border-bottom:1px solid #333;text-align:center;">${t.computed_score}</td>
            <td style="padding:8px;border-bottom:1px solid #333;text-align:right;">${val}</td>
          </tr>`;
        })
        .join("");

      const emailHtml = `
        <div style="background:#0a0a0a;color:#e0e0e0;padding:24px;font-family:system-ui,sans-serif;">
          <h2 style="color:#a78bfa;margin:0 0 8px;">GovBot AI Alert</h2>
          <p style="color:#999;margin:0 0 20px;">${matching.length} new opportunities match your criteria</p>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:2px solid #444;">
                <th style="padding:8px;text-align:left;">Tender</th>
                <th style="padding:8px;text-align:center;">Score</th>
                <th style="padding:8px;text-align:right;">Value</th>
              </tr>
            </thead>
            <tbody>${tenderRows}</tbody>
          </table>
          <p style="margin-top:20px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://govbot.ai"}" 
               style="color:#a78bfa;text-decoration:underline;">
              View in GovBot Dashboard →
            </a>
          </p>
          <p style="color:#666;font-size:12px;margin-top:16px;">
            Update alert preferences in Settings to change notification criteria.
          </p>
        </div>
      `;

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_KEY}`,
          },
          body: JSON.stringify({
            from: "GovBot AI <alerts@govbot.ai>",
            to: profile.email,
            subject: `${matching.length} New Opportunities (Top Score: ${matching[0].computed_score})`,
            html: emailHtml,
          }),
        });
        emailsSent++;
      } catch (err) {
        console.error(`Email send failed for ${profile.email}:`, err);
      }

      // Send Slack notification if configured
      if (pref.slack_webhook) {
        try {
          const tenderList = matching
            .map((t) => `• *${t.title}* — Score: ${t.computed_score}`)
            .join("\n");

          await fetch(pref.slack_webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `🔔 *GovBot Alert:* ${matching.length} new opportunities\n\n${tenderList}`,
            }),
          });
          slackSent++;
        } catch (err) {
          console.error("Slack webhook failed:", err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      emailsSent,
      slackSent,
      tenderCount: newTenders.length,
    });
  } catch (error) {
    console.error("Notification error:", error);
    return NextResponse.json({ error: "Notification send failed" }, { status: 500 });
  }
}
