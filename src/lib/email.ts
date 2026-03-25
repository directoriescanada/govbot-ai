// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Email Notification Service
// Sends opportunity alerts via Resend when high-scoring tenders are found
// ═══════════════════════════════════════════════════════════════════

import { Resend } from "resend";
import { Tender } from "@/types/tender";

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "GovBot AI <alerts@govbot.ai>";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[GovBot Email] RESEND_API_KEY is not set — skipping email send");
    return null;
  }
  return new Resend(apiKey);
}

function formatCurrencyForEmail(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

/**
 * Send an email alert for a single high-scoring tender opportunity.
 * Returns true if the email was sent successfully, false otherwise.
 */
export async function sendOpportunityAlert(params: {
  to: string;
  tender: Pick<
    Tender,
    "title" | "department" | "estimatedValue" | "closingDate" | "computedScore" | "aiScore" | "id"
  >;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;

  const { to, tender } = params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://govbot.ai";
  const score = tender.computedScore ?? tender.aiScore ?? 0;
  const value = formatCurrencyForEmail(tender.estimatedValue || 0);
  const closingDate = tender.closingDate
    ? new Date(tender.closingDate).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Not specified";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background:#1e1b4b;padding:20px 24px;">
        <h1 style="margin:0;color:#a78bfa;font-size:18px;font-weight:700;">GovBot AI</h1>
        <p style="margin:4px 0 0;color:#c4b5fd;font-size:13px;">High-Score Opportunity Alert</p>
      </div>

      <!-- Score Badge -->
      <div style="padding:24px 24px 0;">
        <div style="display:inline-block;background:#059669;color:#ffffff;padding:4px 12px;border-radius:9999px;font-size:13px;font-weight:700;">
          Score: ${score}/100
        </div>
      </div>

      <!-- Tender Details -->
      <div style="padding:16px 24px 24px;">
        <h2 style="margin:0 0 16px;font-size:16px;color:#111827;line-height:1.4;">
          ${escapeHtml(tender.title)}
        </h2>

        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;width:120px;">Department</td>
            <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:500;">${escapeHtml(tender.department)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;border-top:1px solid #f3f4f6;">AI Score</td>
            <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:500;border-top:1px solid #f3f4f6;">${score}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;border-top:1px solid #f3f4f6;">Est. Value</td>
            <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:500;border-top:1px solid #f3f4f6;">${value}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;border-top:1px solid #f3f4f6;">Closing Date</td>
            <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:500;border-top:1px solid #f3f4f6;">${closingDate}</td>
          </tr>
        </table>

        <!-- CTA Button -->
        <div style="margin-top:24px;">
          <a href="${appUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
            View in Dashboard
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:11px;">
          You received this because you have email alerts enabled in GovBot.
          Update your alert preferences in Settings to change notification criteria.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `[Score ${score}] ${tender.title.slice(0, 80)}`,
      html,
    });

    if (error) {
      console.error("[GovBot Email] Resend error:", error);
      return false;
    }

    console.log(`[GovBot Email] Alert sent to ${to} for tender "${tender.title.slice(0, 60)}"`);
    return true;
  } catch (err) {
    console.error("[GovBot Email] Failed to send:", err);
    return false;
  }
}

/**
 * Send alerts for multiple high-scoring tenders in a single digest email.
 * Returns the number of emails sent successfully.
 */
export async function sendBatchOpportunityAlerts(params: {
  to: string;
  tenders: Array<
    Pick<Tender, "title" | "department" | "estimatedValue" | "closingDate" | "computedScore" | "aiScore" | "id">
  >;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;

  const { to, tenders } = params;
  if (tenders.length === 0) return false;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://govbot.ai";
  const topScore = Math.max(...tenders.map((t) => t.computedScore ?? t.aiScore ?? 0));

  const tenderRows = tenders
    .map((t) => {
      const score = t.computedScore ?? t.aiScore ?? 0;
      const value = formatCurrencyForEmail(t.estimatedValue || 0);
      const closing = t.closingDate
        ? new Date(t.closingDate).toLocaleDateString("en-CA")
        : "TBD";

      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">${escapeHtml(t.title.slice(0, 80))}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:center;">
            <span style="background:#059669;color:#fff;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;">${score}</span>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;">${value}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;text-align:right;">${closing}</td>
        </tr>`;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#1e1b4b;padding:20px 24px;">
        <h1 style="margin:0;color:#a78bfa;font-size:18px;font-weight:700;">GovBot AI</h1>
        <p style="margin:4px 0 0;color:#c4b5fd;font-size:13px;">${tenders.length} new high-scoring opportunities found</p>
      </div>

      <div style="padding:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid #e5e7eb;">
              <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Tender</th>
              <th style="padding:8px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;">Score</th>
              <th style="padding:8px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;">Value</th>
              <th style="padding:8px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;">Closing</th>
            </tr>
          </thead>
          <tbody>${tenderRows}</tbody>
        </table>

        <div style="margin-top:24px;">
          <a href="${appUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
            View All in Dashboard
          </a>
        </div>
      </div>

      <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:11px;">
          You received this because you have email alerts enabled in GovBot.
          Update your alert preferences in Settings to change notification criteria.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `${tenders.length} New Opportunities (Top Score: ${topScore})`,
      html,
    });

    if (error) {
      console.error("[GovBot Email] Batch send error:", error);
      return false;
    }

    console.log(`[GovBot Email] Batch alert sent to ${to} with ${tenders.length} tenders`);
    return true;
  } catch (err) {
    console.error("[GovBot Email] Batch send failed:", err);
    return false;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
