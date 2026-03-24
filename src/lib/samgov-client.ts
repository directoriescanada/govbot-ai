// ═══════════════════════════════════════════════════════════════════
// GovBot AI — SAM.gov Opportunities API Client
// Free API — opens the $700B US federal market
//
// API docs: https://open.gsa.gov/api/get-opportunities-public-api/
// Rate limit: 10 requests/day (unauthenticated), 1000/day (with API key)
// Register for API key: https://sam.gov/content/entity-registration
// ═══════════════════════════════════════════════════════════════════

import { Tender, TenderStatus, OpportunitySource, BidComplexity } from "@/types/tender";

const SAM_API_BASE = "https://api.sam.gov/opportunities/v2/search";

interface SamGovSearchParams {
  apiKey: string;
  postedFrom?: string;     // MM/dd/yyyy
  postedTo?: string;
  limit?: number;
  offset?: number;
  ncode?: string;           // NAICS code filter
  typeOfSetAside?: string;  // e.g., "SBA" for small business
  ptype?: string;           // procurement type: o=solicitation, p=presolicitation, etc.
}

interface SamGovOpportunity {
  noticeId: string;
  title: string;
  solicitationNumber: string;
  fullParentPathName: string;     // Department hierarchy
  fullParentPathCode: string;
  postedDate: string;
  type: string;                   // Presolicitation, Solicitation, etc.
  baseType: string;
  archiveType: string;
  archiveDate: string;
  responseDeadLine: string;
  naicsCode: string;
  classificationCode: string;     // PSC code
  active: string;                 // "Yes" / "No"
  description: string;
  organizationType: string;
  uiLink: string;
  award?: {
    awardee: { name: string };
    amount: string;
    date: string;
  };
  pointOfContact?: Array<{
    fullName: string;
    email: string;
    phone: string;
    type: string;
  }>;
  placeOfPerformance?: {
    streetAddress?: string;
    city?: { code: string; name: string };
    state?: { code: string; name: string };
    country?: { code: string; name: string };
  };
  additionalInfoLink?: string;
  setAside?: string;
  setAsideDescription?: string;
}

interface SamGovResponse {
  totalRecords: number;
  opportunitiesData: SamGovOpportunity[];
}

// ─── Fetch Opportunities ────────────────────────────────────────

export async function fetchSamGovOpportunities(
  params: SamGovSearchParams
): Promise<{ tenders: Partial<Tender>[]; total: number }> {
  const {
    apiKey,
    postedFrom,
    postedTo,
    limit = 25,
    offset = 0,
    ncode,
    ptype = "o,p,k", // Solicitations, presolicitations, combined
  } = params;

  const url = new URL(SAM_API_BASE);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("ptype", ptype);

  if (postedFrom) url.searchParams.set("postedFrom", postedFrom);
  if (postedTo) url.searchParams.set("postedTo", postedTo);
  if (ncode) url.searchParams.set("ncode", ncode);

  // Filter for IT and professional services NAICS codes
  if (!ncode) {
    url.searchParams.set("ncode", SAM_SERVICE_NAICS.join(","));
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`SAM.gov API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data: SamGovResponse = await response.json();

  const tenders = (data.opportunitiesData || [])
    .filter(isRelevantOpportunity)
    .map(mapToTender);

  return { tenders, total: data.totalRecords || 0 };
}

// ─── Date Helper ────────────────────────────────────────────────

export function formatSamDate(daysAgo: number = 7): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

// ─── Mapping ────────────────────────────────────────────────────

function mapToTender(opp: SamGovOpportunity): Partial<Tender> {
  const responseDeadline = opp.responseDeadLine
    ? new Date(opp.responseDeadLine).toISOString()
    : "";

  const postedDate = opp.postedDate
    ? new Date(opp.postedDate).toISOString()
    : "";

  // Extract estimated value from description if present
  const valueMatch = opp.description?.match(
    /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|M|k|K))?/
  );
  let estimatedValue = 0;
  if (valueMatch) {
    const raw = valueMatch[0].replace(/[$,]/g, "");
    estimatedValue = parseFloat(raw) || 0;
    if (/million|M/i.test(valueMatch[0])) estimatedValue *= 1_000_000;
    if (/k/i.test(valueMatch[0])) estimatedValue *= 1_000;
  }

  // Extract value from award if present
  if (opp.award?.amount) {
    const awardVal = parseFloat(opp.award.amount.replace(/[^0-9.]/g, ""));
    if (!isNaN(awardVal) && awardVal > 0) estimatedValue = awardVal;
  }

  const region = buildRegionString(opp);

  return {
    externalId: opp.noticeId || opp.solicitationNumber,
    title: opp.title?.trim() || "",
    description: cleanDescription(opp.description || ""),
    department: extractDepartment(opp.fullParentPathName),
    category: "SRV",
    gsin: opp.classificationCode || "",
    closingDate: responseDeadline,
    publicationDate: postedDate,
    estimatedValue,
    solicitationType: mapSolicitationType(opp.type),
    region,
    tradeAgreements: opp.setAside ? [opp.setAsideDescription || opp.setAside] : [],
    source: "sam_gov" as OpportunitySource,
    sourceUrl: opp.uiLink || `https://sam.gov/opp/${opp.noticeId}/view`,
    status: determineStatus(responseDeadline, opp.active),
    aiCategories: [],
    aiScore: 0,
    competitorCount: 0,
    bidComplexity: "Medium" as BidComplexity,
    aiFulfillment: null,
  };
}

// ─── Filtering ──────────────────────────────────────────────────

// NAICS codes for AI-relevant services
const SAM_SERVICE_NAICS = [
  "541511", // Custom Computer Programming
  "541512", // Computer Systems Design
  "541519", // Other Computer Related Services
  "541611", // Administrative Management Consulting
  "541612", // HR Consulting
  "541613", // Marketing Consulting
  "541614", // Process/Logistics Consulting
  "541618", // Other Management Consulting
  "541690", // Other Scientific/Technical Consulting
  "541720", // Research and Development
  "541930", // Translation and Interpretation
  "541990", // All Other Professional Services
  "561410", // Document Preparation
  "611430", // Professional Development Training
];

function isRelevantOpportunity(opp: SamGovOpportunity): boolean {
  if (!opp.noticeId && !opp.solicitationNumber) return false;
  if (opp.active === "No" && !opp.award) return false;

  // Filter out construction, goods-only, etc.
  const title = (opp.title || "").toLowerCase();
  const excludeKeywords = [
    "construction", "janitorial", "custodial", "landscaping",
    "painting", "plumbing", "hvac", "roofing", "paving",
    "demolition", "electrical installation",
  ];
  if (excludeKeywords.some((kw) => title.includes(kw))) return false;

  return true;
}

// ─── Helpers ────────────────────────────────────────────────────

function extractDepartment(fullPath: string): string {
  if (!fullPath) return "US Federal";
  // fullParentPathName is like "DEPT OF DEFENSE.ARMY.ARMY CONTRACTING"
  const parts = fullPath.split(".");
  return parts[0]?.trim() || "US Federal";
}

function buildRegionString(opp: SamGovOpportunity): string {
  const pop = opp.placeOfPerformance;
  if (!pop) return "United States";
  const parts: string[] = [];
  if (pop.city?.name) parts.push(pop.city.name);
  if (pop.state?.name) parts.push(pop.state.name);
  if (pop.country?.name && pop.country.name !== "United States") {
    parts.push(pop.country.name);
  }
  return parts.length > 0 ? parts.join(", ") : "United States";
}

function mapSolicitationType(type: string): string {
  const typeMap: Record<string, string> = {
    Presolicitation: "Pre-Solicitation",
    Solicitation: "RFP",
    "Combined Synopsis/Solicitation": "RFP",
    "Sources Sought": "RFI",
    "Special Notice": "Notice",
    "Award Notice": "Award",
  };
  return typeMap[type] || type || "RFP";
}

function determineStatus(closingDate: string, active: string): TenderStatus {
  if (active === "No") return "closed";
  if (!closingDate) return "open";
  const closing = new Date(closingDate);
  if (isNaN(closing.getTime())) return "open";
  const now = new Date();
  const daysLeft = Math.ceil((closing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "closed";
  if (daysLeft <= 7) return "closing_soon";
  return "open";
}

function cleanDescription(desc: string): string {
  // SAM.gov descriptions often contain HTML
  return desc
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}
