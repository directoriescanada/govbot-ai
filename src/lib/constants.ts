// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Constants & Configuration
// ═══════════════════════════════════════════════════════════════════

import { AICategory, OpportunitySource } from "@/types/tender";

export const AI_CATEGORIES: Record<
  AICategory,
  { label: string; icon: string; color: string; aiScore: number }
> = {
  TRANSLATION: { label: "Translation & Localization", icon: "Globe", color: "teal", aiScore: 98 },
  WRITING: { label: "Research & Report Writing", icon: "FileText", color: "violet", aiScore: 95 },
  DATA_ANALYSIS: { label: "Data Analysis & Visualization", icon: "BarChart3", color: "pink", aiScore: 94 },
  TRANSCRIPTION: { label: "Transcription & Captioning", icon: "Mic", color: "orange", aiScore: 97 },
  DOCUMENT_REVIEW: { label: "Document Review & Summarization", icon: "FileSearch", color: "purple", aiScore: 93 },
  COMMS: { label: "Communications & Content", icon: "Megaphone", color: "emerald", aiScore: 92 },
  TRAINING: { label: "Training Material Development", icon: "GraduationCap", color: "amber", aiScore: 90 },
  SURVEY: { label: "Survey Design & Analysis", icon: "ClipboardList", color: "blue", aiScore: 91 },
  IT_CONSULTING: { label: "IT Advisory & Documentation", icon: "Monitor", color: "fuchsia", aiScore: 85 },
  POLICY: { label: "Policy Research & Drafting", icon: "Scale", color: "orange", aiScore: 88 },
  AUDIT: { label: "Compliance Audit & Assessment", icon: "Search", color: "rose", aiScore: 82 },
  TESTING: { label: "Software Testing & QA", icon: "TestTube2", color: "cyan", aiScore: 86 },
};

export const DATA_SOURCES: Record<
  OpportunitySource,
  { name: string; url: string; feeds: string; status: "live" | "planned" | "coming_soon"; region: string }
> = {
  canadabuys: {
    name: "CanadaBuys (Federal)",
    url: "canadabuys.canada.ca",
    feeds: "Open Data CSV — refreshed every 2 hours",
    status: "live",
    region: "Canada (Federal)",
  },
  merx: {
    name: "MERX (Multi-level)",
    url: "merx.com",
    feeds: "XML/JSON feed — 3,800+ active tenders",
    status: "live",
    region: "Canada (All levels)",
  },
  bcbid: {
    name: "BC Bid (British Columbia)",
    url: "bcbid.gov.bc.ca",
    feeds: "Web scraping pipeline",
    status: "planned",
    region: "British Columbia",
  },
  ontario: {
    name: "Supply Ontario",
    url: "supply.ontario.ca",
    feeds: "API (planned by ON govt)",
    status: "planned",
    region: "Ontario",
  },
  seao: {
    name: "SEAO (Quebec)",
    url: "seao.ca",
    feeds: "Commercial API",
    status: "planned",
    region: "Quebec",
  },
  sam_gov: {
    name: "SAM.gov (US Federal)",
    url: "sam.gov",
    feeds: "Contract Opportunities API v2 — free",
    status: "live",
    region: "United States (Federal)",
  },
  ungm: {
    name: "UNGM (United Nations)",
    url: "ungm.org",
    feeds: "Procurement portal — free registration",
    status: "coming_soon",
    region: "International",
  },
  manual: {
    name: "Manual Upload",
    url: "",
    feeds: "Direct RFP document upload",
    status: "live",
    region: "Any",
  },
};

export const CANADABUYS_ENDPOINTS = {
  tenderNotices: "https://canadabuys.canada.ca/opendata/pub/2025-2026-TenderNotice-AvisAppelOffres.csv",
  newToday: "https://canadabuys.canada.ca/opendata/pub/newTenderNotice-nouvelAvisAppelOffres.csv",
  awardNotices: "https://canadabuys.canada.ca/opendata/pub/2025-2026-awardNotice-avisAttribution.csv",
  dataDictionary: "https://donnees-data.tpsgc-pwgsc.gc.ca/ba2/ac-cb/achatscanada-canadabuys-dd.xml",
};

export const SCORING_WEIGHTS = {
  aiSuitability: 0.35,
  contractValue: 0.20,
  competitionLevel: 0.15,
  timeline: 0.10,
  bidComplexity: 0.10,
  costReduction: 0.10,
};

export const PRICING_TIERS = {
  free: {
    name: "Free",
    price: 0,
    features: [
      "5 opportunity views per day",
      "CanadaBuys federal data only",
      "Basic scoring",
    ],
  },
  scout: {
    name: "Scout",
    price: 99,
    features: [
      "Unlimited opportunity scanning",
      "All Canadian data sources",
      "AI scoring & classification",
      "Email alerts for top opportunities",
      "Award history analytics",
    ],
  },
  pro: {
    name: "Pro",
    price: 249,
    features: [
      "Everything in Scout",
      "AI bid response generator",
      "Compliance matrix extraction",
      "Competitive intelligence",
      "US + International data sources",
      "Priority support",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: 499,
    features: [
      "Everything in Pro",
      "Team collaboration (up to 10 seats)",
      "Custom AI training on your past proposals",
      "API access",
      "White-label reports",
      "Dedicated account manager",
    ],
  },
};

export const CATEGORY_COLORS: Record<string, string> = {
  TRANSLATION: "bg-teal-50 text-teal-700 border-teal-200",
  WRITING: "bg-violet-50 text-violet-700 border-violet-200",
  DATA_ANALYSIS: "bg-pink-50 text-pink-700 border-pink-200",
  TRANSCRIPTION: "bg-orange-50 text-orange-700 border-orange-200",
  DOCUMENT_REVIEW: "bg-purple-50 text-purple-700 border-purple-200",
  COMMS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TRAINING: "bg-amber-50 text-amber-700 border-amber-200",
  SURVEY: "bg-blue-50 text-blue-700 border-blue-200",
  IT_CONSULTING: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  POLICY: "bg-orange-50 text-orange-700 border-orange-200",
  AUDIT: "bg-rose-50 text-rose-700 border-rose-200",
  TESTING: "bg-cyan-50 text-cyan-700 border-cyan-200",
};
