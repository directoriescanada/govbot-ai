// ═══════════════════════════════════════════════════════════════════
// GovBot AI — MERX Data Ingestion Pipeline
// MERX provides provincial, municipal, and MASH-sector tenders
// across all Canadian provinces/territories.
//
// Integration approaches (in order of preference):
//   1. MERX XML Feed (subscription required, ~$800/yr)
//   2. MERX API (contact sales for access)
//   3. Email-to-parse (MERX sends daily digest emails)
//
// This module handles parsing MERX XML feeds and normalizing
// the data into our Tender format.
// ═══════════════════════════════════════════════════════════════════

import { Tender, TenderStatus, BidComplexity, OpportunitySource } from "@/types/tender";

interface MerxTender {
  referenceNumber: string;
  title: string;
  description: string;
  organization: string;
  category: string;
  closingDate: string;
  publishDate: string;
  estimatedValue: string;
  province: string;
  city: string;
  solicitationType: string;
  url: string;
}

export function parseMerxXML(xmlText: string): Partial<Tender>[] {
  const tenders: Partial<Tender>[] = [];

  // Extract individual tender blocks from XML
  const tenderBlocks = xmlText.match(/<opportunity>([\s\S]*?)<\/opportunity>/gi) || [];

  for (const block of tenderBlocks) {
    const tender = extractTenderFromXML(block);
    if (!tender.referenceNumber) continue;

    // Filter for services relevant to AI fulfillment
    if (!isServiceCategory(tender.category)) continue;

    const closingDate = tender.closingDate ? new Date(tender.closingDate).toISOString() : "";
    const value = parseFloat(tender.estimatedValue?.replace(/[^0-9.]/g, "") || "0") || 0;

    tenders.push({
      externalId: `MERX-${tender.referenceNumber}`,
      title: tender.title?.trim() || "",
      description: tender.description?.trim() || "",
      department: tender.organization?.trim() || "",
      category: mapMerxCategory(tender.category),
      gsin: "",
      closingDate,
      publicationDate: tender.publishDate ? new Date(tender.publishDate).toISOString() : "",
      estimatedValue: value,
      solicitationType: tender.solicitationType || "RFP",
      region: buildRegion(tender.province, tender.city),
      tradeAgreements: [],
      source: "merx" as OpportunitySource,
      sourceUrl: tender.url || `https://www.merx.com/search?query=${tender.referenceNumber}`,
      status: determineStatus(closingDate),
      aiCategories: [],
      aiScore: 0,
      competitorCount: 0,
      bidComplexity: "Medium" as BidComplexity,
      aiFulfillment: null,
    });
  }

  return tenders;
}

// For environments where MERX provides JSON (API access)
export function parseMerxJSON(jsonData: MerxTender[]): Partial<Tender>[] {
  return jsonData
    .filter((t) => isServiceCategory(t.category))
    .map((t) => {
      const closingDate = t.closingDate ? new Date(t.closingDate).toISOString() : "";
      const value = parseFloat(t.estimatedValue?.replace(/[^0-9.]/g, "") || "0") || 0;

      return {
        externalId: `MERX-${t.referenceNumber}`,
        title: t.title?.trim() || "",
        description: t.description?.trim() || "",
        department: t.organization?.trim() || "",
        category: mapMerxCategory(t.category),
        gsin: "",
        closingDate,
        publicationDate: t.publishDate ? new Date(t.publishDate).toISOString() : "",
        estimatedValue: value,
        solicitationType: t.solicitationType || "RFP",
        region: buildRegion(t.province, t.city),
        tradeAgreements: [],
        source: "merx" as OpportunitySource,
        sourceUrl: t.url || "",
        status: determineStatus(closingDate),
        aiCategories: [],
        aiScore: 0,
        competitorCount: 0,
        bidComplexity: "Medium" as BidComplexity,
        aiFulfillment: null,
      };
    })
    .filter((t) => t.externalId);
}

// ─── XML Helpers ────────────────────────────────────────────────

function extractTenderFromXML(block: string): MerxTender {
  return {
    referenceNumber: extractTag(block, "referenceNumber") || extractTag(block, "reference_number") || "",
    title: extractTag(block, "title") || "",
    description: extractTag(block, "description") || extractTag(block, "abstract") || "",
    organization: extractTag(block, "organization") || extractTag(block, "buyer") || "",
    category: extractTag(block, "category") || extractTag(block, "commodityType") || "",
    closingDate: extractTag(block, "closingDate") || extractTag(block, "closing_date") || "",
    publishDate: extractTag(block, "publishDate") || extractTag(block, "publish_date") || "",
    estimatedValue: extractTag(block, "estimatedValue") || extractTag(block, "value") || "",
    province: extractTag(block, "province") || extractTag(block, "region") || "",
    city: extractTag(block, "city") || "",
    solicitationType: extractTag(block, "solicitationType") || extractTag(block, "type") || "",
    url: extractTag(block, "url") || extractTag(block, "link") || "",
  };
}

function extractTag(xml: string, tagName: string): string {
  // Handle both <tagName>value</tagName> and <tag_name>value</tag_name>
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const match = xml.match(regex);
  if (!match) return "";
  // Strip CDATA wrappers
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

// ─── Category Mapping ───────────────────────────────────────────

const SERVICE_KEYWORDS = [
  "consulting", "professional services", "advisory", "research",
  "analysis", "review", "writing", "training", "translation",
  "communications", "audit", "assessment", "survey", "testing",
  "documentation", "technical", "management", "planning",
  "evaluation", "report", "study", "strategy", "it services",
  "data", "digital", "software", "technology", "information",
];

function isServiceCategory(category: string): boolean {
  if (!category) return true; // Include uncategorized tenders
  const lower = category.toLowerCase();
  // Exclude goods-only categories
  if (/^(goods|construction|equipment|supplies|materials|furniture|vehicles)$/i.test(lower)) {
    return false;
  }
  return SERVICE_KEYWORDS.some((kw) => lower.includes(kw)) || lower.includes("service");
}

function mapMerxCategory(category: string): string {
  if (!category) return "SRV";
  const lower = category.toLowerCase();
  if (lower.includes("it") || lower.includes("tech") || lower.includes("software")) return "SRVTGD";
  return "SRV";
}

function buildRegion(province: string, city: string): string {
  const parts: string[] = [];
  if (city) parts.push(city);
  if (province) parts.push(province);
  return parts.join(", ") || "Canada";
}

function determineStatus(closingDate: string): TenderStatus {
  if (!closingDate) return "open";
  const closing = new Date(closingDate);
  if (isNaN(closing.getTime())) return "open";
  const now = new Date();
  const daysLeft = Math.ceil((closing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "closed";
  if (daysLeft <= 7) return "closing_soon";
  return "open";
}
