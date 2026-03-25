// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Client-safe synchronous config access
// This file contains NO server imports and is safe for client components.
// For async/Supabase config operations, use config.ts directly.
// ═══════════════════════════════════════════════════════════════════

import type { GovBotConfig } from "./config";

// Re-export the sync accessor. The actual _config state lives in config.ts
// but we access it through a getter to avoid importing the full config module.
let _configRef: GovBotConfig | null = null;

// Called by config.ts to register the config reference
export function _registerConfig(config: GovBotConfig) {
  _configRef = config;
}

// Default config values for client-side use when config hasn't been loaded yet
const CLIENT_DEFAULTS = {
  scoring: {
    weights: { aiSuitability: 0.35, contractValue: 0.20, competitionLevel: 0.15, timeline: 0.10, bidComplexity: 0.10, costReduction: 0.10 },
    scoreThresholds: { high: 80, medium: 60, low: 40 },
    urgencyDays: { critical: 3, warning: 7, approaching: 14 },
    maxCompetitors: 30,
  },
  risk: { riskTolerance: "moderate" as const, maxActiveContracts: 10, monthlyBudgetCap: 50000, minDaysBeforeClosing: 5 },
  blockers: {
    hasSecurityClearance: false,
    hasProfessionalLicense: [] as string[],
    canBeOnSite: false,
    isCanadianCitizen: true,
    hasProfessionalInsurance: false,
    isBilingual: false,
  },
  scanning: { excludeKeywords: [] as string[] },
  bidding: { defaultBidPercent: 82, defaultCostReduction: 65, autoBidMinScore: 90, maxAutoBidsPerWeek: 20, costBreakdown: { aiCosts: 0.35, humanCosts: 0.25, infrastructure: 0.10, overhead: 0.15, qa: 0.15 } },
};

export function getConfigSectionSync<K extends string>(key: K): any {
  if (_configRef && key in _configRef) {
    return (_configRef as any)[key];
  }
  return (CLIENT_DEFAULTS as any)[key] || {};
}
