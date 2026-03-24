import Papa from "papaparse";
import { Tender, TenderStatus } from "@/types/tender";

interface CanadaBuysRow {
  [key: string]: string | undefined;
}

export function parseCanadaBuysCSV(csvText: string): Partial<Tender>[] {
  const result = Papa.parse<CanadaBuysRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors.length > 0) {
    console.warn(`CSV parse: ${result.errors.length} warnings. First 5:`, result.errors.slice(0, 5));
  }

  // Detect column names dynamically — handle format changes
  const headers = result.meta.fields || [];
  const colMap = detectColumns(headers);

  if (!colMap.id || !colMap.title) {
    console.error("CSV format error: required columns (id, title) not found. Headers:", headers.slice(0, 10));
    return [];
  }

  console.log("CSV column mapping:", JSON.stringify(colMap));
  console.log(`CSV rows: ${result.data.length}`);

  return result.data
    .filter((row) => {
      const category = (row[colMap.category || ""] || "").replace(/^\*/, "");
      return category === "SRV" || category === "SRVTGD" || !colMap.category || !category;
    })
    .map((row): Partial<Tender> => {
      const closingDate = row[colMap.closingDate || ""] || "";
      const estimatedValueStr = row[colMap.value || ""] || "0";
      const estimatedValue = parseFloat(estimatedValueStr.replace(/[^0-9.]/g, "")) || 0;

      return {
        externalId: (row[colMap.id || ""] || "").trim(),
        title: extractEnglish(row[colMap.title || ""] || ""),
        description: extractEnglish(row[colMap.description || ""] || ""),
        department: extractEnglish(row[colMap.department || ""] || ""),
        category: (row[colMap.category || ""] || "SRV").replace(/^\*/, ""),
        gsin: (row[colMap.gsin || ""] || "").replace(/^\*/, "").trim(),
        closingDate: sanitizeDate(closingDate),
        publicationDate: sanitizeDate(row[colMap.pubDate || ""] || ""),
        estimatedValue,
        solicitationType: (row[colMap.solType || ""] || "RFP").trim(),
        region: extractEnglish(row[colMap.region || ""] || ""),
        tradeAgreements: parseTradeAgreements(row[colMap.tradeAgreements || ""] || ""),
        source: "canadabuys",
        sourceUrl: (row[colMap.url || ""] || "").trim(),
        status: determineStatus(closingDate),
        aiCategories: [],
        aiScore: 0,
        competitorCount: 0,
        bidComplexity: "Medium",
        aiFulfillment: null,
      };
    })
    .filter((t) => t.externalId); // Drop rows with no ID
}

export interface CanadaBuysAwardRow {
  [key: string]: string | undefined;
}

export function parseAwardNoticesCSV(csvText: string) {
  const result = Papa.parse<CanadaBuysAwardRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  const headers = result.meta.fields || [];
  const colMap = detectAwardColumns(headers);

  return result.data
    .filter((row) => {
      const cat = (row[colMap.category || ""] || "").replace(/^\*/, "");
      return cat === "SRV" || cat === "SRVTGD" || !colMap.category || !cat;
    })
    .map((row) => ({
      externalId: (row[colMap.id || ""] || "").trim(),
      title: extractEnglish(row[colMap.title || ""] || ""),
      department: extractEnglish(row[colMap.department || ""] || ""),
      awardDate: sanitizeDate(row[colMap.awardDate || ""] || ""),
      vendorName: extractEnglish(row[colMap.vendor || ""] || ""),
      contractValue: parseFloat((row[colMap.value || ""] || "0").replace(/[^0-9.]/g, "")) || 0,
      category: row[colMap.category || ""] || "SRV",
      gsin: (row[colMap.gsin || ""] || "").trim(),
      source: "canadabuys" as const,
    }))
    .filter((a) => a.externalId);
}

// ─── Column Detection ───────────────────────────────────────────
// Handles format changes by matching patterns rather than exact names

function detectColumns(headers: string[]) {
  const find = (patterns: RegExp[]) =>
    headers.find((h) => {
      const normalized = h.replace(/[-\s]/g, "").toLowerCase();
      return patterns.some((p) => p.test(normalized));
    });

  return {
    id: find([/referencenumber/, /numeroreference/, /tendernoticeid/, /idavis/]) || find([/solicitationnumber/]) || find([/^id$/]),
    title: find([/^titletitre/, /^titletitreeng$/]),
    description: find([/tenderdescription/, /descriptionappeloffres/]),
    department: find([/contractingentityname/, /nomentitcontractante/, /organization/, /organisation/]),
    category: find([/procurementcategor/, /categorieapprovisionnement/]),
    gsin: find([/^gsinnibs$/, /^gsin$/]),
    closingDate: find([/tenderclosingdate/, /appeloffresdatecloture/, /closingdate/]),
    pubDate: find([/publicationdate/, /datepublication/]),
    value: find([/estimatedvalue/, /valeurestim/]),
    solType: find([/noticetype/, /avistype/, /procurementmethod/, /methodeapprovisionnement/]),
    region: find([/regionsofopportunity/, /regionappeloffres/, /^region/]),
    tradeAgreements: find([/tradeagreements/, /accordscommerciaux/]),
    url: find([/noticeurl/, /urlavis/]),
  };
}

function detectAwardColumns(headers: string[]) {
  const find = (patterns: RegExp[]) =>
    headers.find((h) => {
      const normalized = h.replace(/[-\s]/g, "").toLowerCase();
      return patterns.some((p) => p.test(normalized));
    });

  return {
    id: find([/referencenumber/, /numeroreference/, /awardnoticeid/, /idavisattrib/]) || find([/^id$/]),
    title: find([/^titletitre/, /^titletitreeng$/]),
    department: find([/contractingentityname/, /nomentitcontractante/, /organization/]),
    awardDate: find([/awarddate/, /dateattrib/, /contractawarddate/]),
    vendor: find([/vendorname/, /nomfournisseur/, /suppliername/]),
    value: find([/contractvalue/, /valeurcontrat/, /totalcontractvalue/]),
    category: find([/procurementcategor/, /categorieapprovisionnement/]),
    gsin: find([/^gsinnibs$/, /^gsin$/]),
  };
}

// ─── Bilingual Text Handling ────────────────────────────────────

function extractEnglish(text: string): string {
  if (!text) return "";

  // CanadaBuys uses " / " to separate EN and FR
  const separatorIndex = text.indexOf(" / ");
  if (separatorIndex === -1) {
    // No separator — detect language
    if (isFrenchText(text)) {
      return `[FR] ${text.trim()}`;
    }
    return text.trim();
  }

  const enPart = text.slice(0, separatorIndex).trim();
  // If the English part is empty, fall back to the full text
  return enPart || text.trim();
}

function isFrenchText(text: string): boolean {
  const frenchIndicators = [
    /\bde\s+la\b/i, /\bdu\b/i, /\bdes\b/i, /\baux\b/i,
    /\bpour\b/i, /\bavec\b/i, /\bdans\b/i, /\bsur\b/i,
    /\bservices?\s+de\b/i, /\bgouvernement\b/i, /\bministère\b/i,
  ];
  let frenchCount = 0;
  for (const pattern of frenchIndicators) {
    if (pattern.test(text)) frenchCount++;
  }
  // If 3+ French indicators, likely French
  return frenchCount >= 3;
}

// ─── Helpers ────────────────────────────────────────────────────

function parseTradeAgreements(text: string): string[] {
  if (!text) return [];
  return text.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

function sanitizeDate(dateStr: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
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
