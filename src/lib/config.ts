// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Centralized Configuration Store
// All tunable parameters in one place. Persists in-memory (module level).
// In production, load/save from Supabase `config` table.
// ═══════════════════════════════════════════════════════════════════

import { AICategory } from "@/types/tender";

// ─── Company Profile ─────────────────────────────────────────────────────────

export interface CompanyProfile {
  companyName: string;
  contactEmail: string;
  phone: string;
  address: string;
  website: string;
  businessNumber: string;        // CRA Business Number
  pspcSupplierId: string;       // SAP Ariba / PSPC Supplier ID
  pbn: string;                   // Procurement Business Number
  securityClearanceLevel: string; // "none" | "reliability" | "secret" | "top_secret"
  aboutUs: string;               // Default company profile for bids
  capabilities: string[];        // What we can deliver
}

// ─── Scanning & Filtering ────────────────────────────────────────────────────

export interface ScanningConfig {
  minAiScore: number;            // Inbox filter floor (default 80)
  minContractValue: number;      // Minimum $ to show (default 5000)
  maxContractValue: number;      // Maximum $ to show (default 2000000)
  enabledSources: string[];      // Which data sources to scan
  enabledCategories: AICategory[]; // Which AI categories to pursue
  scanIntervalHours: number;     // How often to refresh (default 2)
  excludeDepartments: string[];  // Departments to always skip
  excludeKeywords: string[];     // Title keywords to skip (e.g. "construction")
}

// ─── Scoring Weights ─────────────────────────────────────────────────────────

export interface ScoringConfig {
  weights: {
    aiSuitability: number;       // default 0.35
    contractValue: number;       // default 0.20
    competitionLevel: number;    // default 0.15
    timeline: number;            // default 0.10
    bidComplexity: number;       // default 0.10
    costReduction: number;       // default 0.10
  };
  scoreThresholds: {
    high: number;                // default 80 (green)
    medium: number;              // default 60 (amber)
  };
  urgencyDays: {
    critical: number;            // default 7 (red)
    warning: number;             // default 14 (amber)
    approaching: number;         // default 30 (light amber)
  };
  maxCompetitors: number;        // normalizer baseline (default 25)
}

// ─── Bidding Strategy ────────────────────────────────────────────────────────

export interface BiddingConfig {
  defaultBidPercent: number;     // % of estimate to bid (default 82)
  minBidPercent: number;         // floor (default 70)
  maxBidPercent: number;         // ceiling (default 95)
  autoBidMinScore: number;       // auto-draft bids above this (default 90)
  autoBidEnabled: boolean;       // whether auto-bid is active
  maxAutoBidsPerWeek: number;    // cap on auto-generated bids (default 20)
  costBreakdown: {
    aiCosts: number;             // % of delivery cost (default 0.20)
    humanCosts: number;          // default 0.45
    infrastructure: number;      // default 0.12
    overhead: number;            // default 0.10
    qa: number;                  // default 0.13
  };
  defaultCostReduction: number;  // assumed cost savings % (default 60)
}

// ─── Fulfillment ─────────────────────────────────────────────────────────────

export interface FulfillmentConfig {
  multiPassEnabled: boolean;     // use 4-pass quality pipeline (default true)
  numberOfPasses: number;        // 1-4 (default 4)
  claudeModel: string;          // which Claude model (default "claude-sonnet-4-20250514")
  maxTokens: number;             // per API call (default 8000)
  targetReadingLevel: number;    // Flesch-Kincaid grade (default 8)
  requireHumanReview: boolean;   // must review before marking delivered (default true)
}

// ─── Alerts & Notifications ──────────────────────────────────────────────────

export interface AlertConfig {
  emailEnabled: boolean;
  emailAddress: string;
  slackWebhookUrl: string;
  alertMinScore: number;         // notify when score >= this (default 85)
  alertCategories: AICategory[]; // which categories to alert on (default all)
  digestEnabled: boolean;        // daily summary email
  digestTime: string;            // "08:00" 24h format
}

// ─── Document Export ─────────────────────────────────────────────────────────

export interface DocumentConfig {
  font: string;                  // default "Calibri"
  bodySize: number;              // pt (default 11)
  headingSize: number;           // pt (default 14)
  headerText: string;            // appears on every page
  footerText: string;            // appears on every page
  includeConfidential: boolean;  // add CONFIDENTIAL watermark (default true)
  coverPageLogo: boolean;        // include logo on cover (default false)
}

// ─── Risk Management ────────────────────────────────────────────────────────

export interface RiskConfig {
  riskTolerance: "conservative" | "moderate" | "aggressive"; // affects bidding and target selection
  maxActiveContracts: number;      // capacity limit (default 5)
  maxMonthlyBidSpend: number;      // API cost budget per month $ (default 200)
  requireInsuranceForBids: boolean; // skip tenders requiring insurance if you don't have it (default true)
  minDaysBeforeClosing: number;    // don't bid if closing < X days (default 5)
  maxBidValueWithoutReview: number; // auto-approve bids under this amount (default 25000)
}

// ─── Regional Preferences ───────────────────────────────────────────────────

export interface RegionalConfig {
  primaryRegion: "canada" | "usa" | "both";
  targetProvinces: string[];       // e.g. ["Ontario", "British Columbia", "Quebec"]
  federalOnly: boolean;            // only federal contracts, skip provincial/municipal (default false)
  preferBilingual: boolean;        // prefer bilingual contracts (default false)
  excludeRemoteRegions: boolean;   // skip territories and remote areas (default false)
}

// ─── Win Tracking ───────────────────────────────────────────────────────────

export interface WinTrackingConfig {
  trackWinLoss: boolean;           // enable win/loss tracking (default true)
  autoSaveWinningTemplates: boolean; // save winning bids as templates (default true)
  feedbackLoopEnabled: boolean;    // adjust scoring based on win/loss data (default true)
  targetWinRate: number;           // goal win rate % (default 25)
  targetMonthlyRevenue: number;    // revenue goal $ (default 50000)
}

// ─── API Keys & Connections ─────────────────────────────────────────────────

export interface ApiKeysConfig {
  anthropicKeySet: boolean;        // read-only indicator (never store actual keys here)
  supabaseConnected: boolean;      // read-only
  stripeConnected: boolean;        // read-only
  resendConnected: boolean;        // read-only
  samGovKeySet: boolean;           // read-only
  merxSubscribed: boolean;         // read-only
}

// ─── Bid Templates ──────────────────────────────────────────────────────────

export interface BidTemplateConfig {
  defaultIntroduction: string;     // standard opening paragraph for proposals
  defaultClosing: string;          // standard closing paragraph
  teamDescription: string;         // team/org description used in bids
  pastPerformance: string[];       // list of past performance summaries
  certifications: string[];        // ISO, CMMI, etc.
  differentiators: string[];       // key selling points
}

// ─── Blocker Overrides ───────────────────────────────────────────────────────

export interface BlockerConfig {
  hasSecurityClearance: boolean;        // if true, clearance blockers become soft
  hasProfessionalLicense: string[];     // list of licenses you hold
  canBeOnSite: boolean;                 // if true, physical presence blockers become soft
  isCanadianCitizen: boolean;           // if true, citizenship blocker becomes soft
  hasProfessionalInsurance: boolean;    // if true, insurance blocker becomes soft
  isBilingual: boolean;                 // if true, bilingual blocker becomes soft
}

// ─── Master Config ───────────────────────────────────────────────────────────

export interface GovBotConfig {
  company: CompanyProfile;
  scanning: ScanningConfig;
  regional: RegionalConfig;
  scoring: ScoringConfig;
  bidding: BiddingConfig;
  risk: RiskConfig;
  fulfillment: FulfillmentConfig;
  bidTemplates: BidTemplateConfig;
  winTracking: WinTrackingConfig;
  alerts: AlertConfig;
  documents: DocumentConfig;
  blockers: BlockerConfig;
  apiKeys: ApiKeysConfig;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: GovBotConfig = {
  company: {
    companyName: "GovBot AI Solutions Inc.",
    contactEmail: "",
    phone: "",
    address: "",
    website: "",
    businessNumber: "",
    pspcSupplierId: "",
    pbn: "",
    securityClearanceLevel: "none",
    aboutUs: "We are an AI-native professional services firm specializing in government contract delivery. Our AI-powered workflows deliver faster turnaround, consistent quality, and significant cost savings to Canadian taxpayers. Registered federal supplier, Canadian-owned and operated.",
    capabilities: [
      "Translation & Localization (EN/FR)",
      "Research & Report Writing",
      "Data Analysis & Visualization",
      "Communications & Content Creation",
      "Training Material Development",
      "Survey Design & Analysis",
      "Policy Research & Drafting",
      "Document Review & Summarization",
    ],
  },

  scanning: {
    minAiScore: 80,
    minContractValue: 5_000,
    maxContractValue: 2_000_000,
    enabledSources: ["canadabuys", "merx", "sam_gov", "manual"],
    enabledCategories: [
      "TRANSLATION", "WRITING", "DATA_ANALYSIS", "TRANSCRIPTION",
      "DOCUMENT_REVIEW", "COMMS", "TRAINING", "SURVEY",
      "IT_CONSULTING", "POLICY", "AUDIT", "TESTING",
    ],
    scanIntervalHours: 2,
    excludeDepartments: [],
    excludeKeywords: ["construction", "building", "renovation", "plumbing", "electrical"],
  },

  regional: {
    primaryRegion: "canada",
    targetProvinces: ["Ontario", "British Columbia", "Quebec"],
    federalOnly: false,
    preferBilingual: false,
    excludeRemoteRegions: false,
  },

  scoring: {
    weights: {
      aiSuitability: 0.35,
      contractValue: 0.20,
      competitionLevel: 0.15,
      timeline: 0.10,
      bidComplexity: 0.10,
      costReduction: 0.10,
    },
    scoreThresholds: { high: 80, medium: 60 },
    urgencyDays: { critical: 7, warning: 14, approaching: 30 },
    maxCompetitors: 25,
  },

  bidding: {
    defaultBidPercent: 82,
    minBidPercent: 70,
    maxBidPercent: 95,
    autoBidMinScore: 90,
    autoBidEnabled: false,
    maxAutoBidsPerWeek: 20,
    costBreakdown: {
      aiCosts: 0.20,
      humanCosts: 0.45,
      infrastructure: 0.12,
      overhead: 0.10,
      qa: 0.13,
    },
    defaultCostReduction: 60,
  },

  risk: {
    riskTolerance: "moderate",
    maxActiveContracts: 5,
    maxMonthlyBidSpend: 200,
    requireInsuranceForBids: true,
    minDaysBeforeClosing: 5,
    maxBidValueWithoutReview: 25000,
  },

  fulfillment: {
    multiPassEnabled: true,
    numberOfPasses: 4,
    claudeModel: "claude-sonnet-4-20250514",
    maxTokens: 8000,
    targetReadingLevel: 8,
    requireHumanReview: true,
  },

  bidTemplates: {
    defaultIntroduction: "Thank you for the opportunity to submit our proposal. Our team brings extensive experience in delivering high-quality, AI-powered professional services to Canadian government departments.",
    defaultClosing: "We appreciate your consideration and look forward to the opportunity to deliver exceptional results. Please do not hesitate to contact us with any questions.",
    teamDescription: "Our team combines deep expertise in AI and machine learning with extensive experience in Canadian government procurement. We deliver consistent, high-quality results through our proprietary AI-powered workflows.",
    pastPerformance: [],
    certifications: [],
    differentiators: [
      "AI-powered delivery for faster turnaround",
      "Significant cost savings vs. traditional approaches",
      "Canadian-owned and operated",
      "Registered federal supplier",
    ],
  },

  winTracking: {
    trackWinLoss: true,
    autoSaveWinningTemplates: true,
    feedbackLoopEnabled: true,
    targetWinRate: 25,
    targetMonthlyRevenue: 50000,
  },

  alerts: {
    emailEnabled: false,
    emailAddress: "",
    slackWebhookUrl: "",
    alertMinScore: 85,
    alertCategories: [
      "TRANSLATION", "WRITING", "DATA_ANALYSIS", "TRANSCRIPTION",
      "DOCUMENT_REVIEW", "COMMS", "TRAINING", "SURVEY",
    ],
    digestEnabled: false,
    digestTime: "08:00",
  },

  documents: {
    font: "Calibri",
    bodySize: 11,
    headingSize: 14,
    headerText: "GovBot AI Solutions Inc.",
    footerText: "Confidential — Prepared by GovBot AI Solutions Inc.",
    includeConfidential: true,
    coverPageLogo: false,
  },

  blockers: {
    hasSecurityClearance: false,
    hasProfessionalLicense: [],
    canBeOnSite: false,
    isCanadianCitizen: true,
    hasProfessionalInsurance: false,
    isBilingual: false,
  },

  apiKeys: {
    anthropicKeySet: false,
    supabaseConnected: false,
    stripeConnected: false,
    resendConnected: false,
    samGovKeySet: false,
    merxSubscribed: false,
  },
};

// ─── Runtime store ───────────────────────────────────────────────────────────

let _config: GovBotConfig = structuredClone(DEFAULT_CONFIG);

export function getConfig(): GovBotConfig {
  return _config;
}

export function getConfigSection<K extends keyof GovBotConfig>(key: K): GovBotConfig[K] {
  return _config[key];
}

export function updateConfig(patch: Partial<GovBotConfig>): GovBotConfig {
  _config = deepMerge(_config, patch) as GovBotConfig;
  return _config;
}

export function updateConfigSection<K extends keyof GovBotConfig>(
  key: K,
  patch: Partial<GovBotConfig[K]>
): GovBotConfig {
  _config = {
    ..._config,
    [key]: deepMerge(_config[key], patch),
  };
  return _config;
}

export function resetConfig(): GovBotConfig {
  _config = structuredClone(DEFAULT_CONFIG);
  return _config;
}

export function resetConfigSection<K extends keyof GovBotConfig>(key: K): GovBotConfig {
  _config = {
    ..._config,
    [key]: structuredClone(DEFAULT_CONFIG[key]),
  };
  return _config;
}

// ─── Deep merge utility ──────────────────────────────────────────────────────

function deepMerge(target: unknown, source: unknown): unknown {
  if (Array.isArray(source)) return source;
  if (source === null || source === undefined) return target;
  if (typeof source !== "object") return source;
  if (typeof target !== "object" || target === null) return source;

  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const key of Object.keys(source as Record<string, unknown>)) {
    result[key] = deepMerge(
      (target as Record<string, unknown>)[key],
      (source as Record<string, unknown>)[key]
    );
  }
  return result;
}
