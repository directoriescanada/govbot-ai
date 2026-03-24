"use client";

import { useEffect, useState, useCallback, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { AI_CATEGORIES, DATA_SOURCES } from "@/lib/constants";
import type { AICategory, OpportunitySource } from "@/types/tender";
import type { GovBotConfig } from "@/lib/config";
import {
  Settings,
  Building2,
  Search,
  Globe,
  Target,
  DollarSign,
  Shield,
  Zap,
  FileEdit,
  Trophy,
  Bell,
  FileText,
  ShieldAlert,
  Key,
  Plus,
  X,
  RotateCcw,
  Save,
  Loader2,
  Sparkles,
  Check,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

type SectionKey = keyof GovBotConfig;

interface Recommendation {
  section: string;
  field: string;
  currentValue: unknown;
  suggestedValue: unknown;
  reason: string;
  impact: "high" | "medium" | "low";
}

interface OptimizationResponse {
  recommendations: Recommendation[];
  overallStrategy: string;
  estimatedImpact: {
    winRateChange: string;
    revenueChange: string;
  };
  optimizedConfig?: GovBotConfig;
}

interface SidebarSection {
  key: string;
  label: string;
  icon: React.ElementType;
  configKey?: SectionKey;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const SECTIONS: SidebarSection[] = [
  { key: "company", label: "Company Profile", icon: Building2, configKey: "company" },
  { key: "scanning", label: "Scanning & Filters", icon: Search, configKey: "scanning" },
  { key: "regional", label: "Regional Preferences", icon: Globe, configKey: "regional" },
  { key: "scoring", label: "Scoring Weights", icon: Target, configKey: "scoring" },
  { key: "bidding", label: "Bidding Strategy", icon: DollarSign, configKey: "bidding" },
  { key: "risk", label: "Risk Management", icon: Shield, configKey: "risk" },
  { key: "fulfillment", label: "Fulfillment", icon: Zap, configKey: "fulfillment" },
  { key: "bidTemplates", label: "Bid Templates", icon: FileEdit, configKey: "bidTemplates" },
  { key: "winTracking", label: "Win Tracking", icon: Trophy, configKey: "winTracking" },
  { key: "alerts", label: "Alerts & Notifications", icon: Bell, configKey: "alerts" },
  { key: "documents", label: "Documents", icon: FileText, configKey: "documents" },
  { key: "blockers", label: "Blockers", icon: ShieldAlert, configKey: "blockers" },
  { key: "apiKeys", label: "API & Connections", icon: Key, configKey: "apiKeys" },
];

const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
];

// ═══════════════════════════════════════════════════════════════════════════════
// API Helpers
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchConfig(): Promise<GovBotConfig> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to load configuration");
  return res.json();
}

async function saveSection(section: SectionKey, data: unknown): Promise<void> {
  const res = await fetch("/api/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, data }),
  });
  if (!res.ok) throw new Error("Failed to save settings");
}

async function resetAll(): Promise<GovBotConfig> {
  const res = await fetch("/api/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset: true }),
  });
  if (!res.ok) throw new Error("Failed to reset settings");
  return res.json();
}

async function resetSection(section: SectionKey): Promise<GovBotConfig> {
  const res = await fetch("/api/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset: section }),
  });
  if (!res.ok) throw new Error("Failed to reset section");
  return res.json();
}

async function fetchOptimization(): Promise<OptimizationResponse> {
  const res = await fetch("/api/config/optimize", { method: "POST" });
  if (!res.ok) throw new Error("Optimization failed");
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Reusable Components
// ═══════════════════════════════════════════════════════════════════════════════

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput("");
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const remove = (idx: number) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, idx) => (
          <Badge key={idx} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Type and press Enter to add"}
        className="bg-muted/50"
      />
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground mt-1">{children}</p>;
}

function SectionFooter({
  section,
  saving,
  onSave,
  onReset,
}: {
  section: string;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <Button variant="ghost" size="sm" onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground">
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
        Restore Defaults
      </Button>
      <Button onClick={onSave} disabled={saving} size="sm">
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Save
      </Button>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <CardHeader className="pb-4">
      <CardTitle className="text-lg">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  );
}

function ImpactBadge({ impact }: { impact: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return (
    <Badge variant="outline" className={`text-xs ${styles[impact]}`}>
      {impact}
    </Badge>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge className="bg-green-100 text-green-700 border-green-200" variant="outline">
      <Check className="mr-1 h-3 w-3" /> Connected
    </Badge>
  ) : (
    <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">
      <X className="mr-1 h-3 w-3" /> Not Connected
    </Badge>
  );
}

function SettingsSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-[220px] border-r p-4 space-y-3">
        {Array.from({ length: 13 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <div className="flex-1 p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const [config, setConfig] = useState<GovBotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [activeSection, setActiveSection] = useState("company");

  // AI Optimization state
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<OptimizationResponse | null>(null);
  const [showOptPanel, setShowOptPanel] = useState(false);
  const [selectedRecs, setSelectedRecs] = useState<Set<number>>(new Set());

  // Local form state for each section
  const [company, setCompany] = useState<GovBotConfig["company"] | null>(null);
  const [scanning, setScanning] = useState<GovBotConfig["scanning"] | null>(null);
  const [regional, setRegional] = useState<GovBotConfig["regional"] | null>(null);
  const [scoring, setScoring] = useState<GovBotConfig["scoring"] | null>(null);
  const [bidding, setBidding] = useState<GovBotConfig["bidding"] | null>(null);
  const [risk, setRisk] = useState<GovBotConfig["risk"] | null>(null);
  const [fulfillment, setFulfillment] = useState<GovBotConfig["fulfillment"] | null>(null);
  const [bidTemplates, setBidTemplates] = useState<GovBotConfig["bidTemplates"] | null>(null);
  const [winTracking, setWinTracking] = useState<GovBotConfig["winTracking"] | null>(null);
  const [alerts, setAlerts] = useState<GovBotConfig["alerts"] | null>(null);
  const [documents, setDocuments] = useState<GovBotConfig["documents"] | null>(null);
  const [blockers, setBlockers] = useState<GovBotConfig["blockers"] | null>(null);
  const [apiKeys, setApiKeys] = useState<GovBotConfig["apiKeys"] | null>(null);

  // Refs for scroll-into-view
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const populateFromConfig = useCallback((cfg: GovBotConfig) => {
    setConfig(cfg);
    setCompany(structuredClone(cfg.company));
    setScanning(structuredClone(cfg.scanning));
    setRegional(structuredClone(cfg.regional));
    setScoring(structuredClone(cfg.scoring));
    setBidding(structuredClone(cfg.bidding));
    setRisk(structuredClone(cfg.risk));
    setFulfillment(structuredClone(cfg.fulfillment));
    setBidTemplates(structuredClone(cfg.bidTemplates));
    setWinTracking(structuredClone(cfg.winTracking));
    setAlerts(structuredClone(cfg.alerts));
    setDocuments(structuredClone(cfg.documents));
    setBlockers(structuredClone(cfg.blockers));
    setApiKeys(structuredClone(cfg.apiKeys));
  }, []);

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        populateFromConfig(cfg);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load settings");
        setLoading(false);
      });
  }, [populateFromConfig]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const dataMap = (): Record<SectionKey, unknown> => ({
    company,
    scanning,
    regional,
    scoring,
    bidding,
    risk,
    fulfillment,
    bidTemplates,
    winTracking,
    alerts,
    documents,
    blockers,
    apiKeys,
  });

  const handleSave = async (section: SectionKey) => {
    setSavingSection(section);
    try {
      await saveSection(section, dataMap()[section]);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSection(null);
    }
  };

  const handleResetSection = async (section: SectionKey) => {
    try {
      const cfg = await resetSection(section);
      populateFromConfig(cfg);
      toast.success(`${section} reset to defaults`);
    } catch {
      toast.error("Failed to reset section");
    }
  };

  const handleResetAll = async () => {
    if (!confirm("Reset ALL settings to defaults? This cannot be undone.")) return;
    try {
      const cfg = await resetAll();
      populateFromConfig(cfg);
      toast.success("All settings reset to defaults");
    } catch {
      toast.error("Failed to reset settings");
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const result = await fetchOptimization();
      setOptimization(result);
      setSelectedRecs(new Set(result.recommendations.map((_, i) => i)));
      setShowOptPanel(true);
    } catch {
      toast.error("AI optimization failed");
    } finally {
      setOptimizing(false);
    }
  };

  const handleApplyOptimization = async (applyAll: boolean) => {
    if (!optimization?.optimizedConfig) return;
    try {
      if (applyAll) {
        // Patch the full optimized config
        const res = await fetch("/api/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: optimization.optimizedConfig }),
        });
        if (!res.ok) throw new Error("Failed to apply");
        const cfg = await res.json();
        populateFromConfig(cfg);
      } else {
        // Apply only selected recommendations by patching individual sections
        const patches: Record<string, Record<string, unknown>> = {};
        optimization.recommendations.forEach((rec, idx) => {
          if (!selectedRecs.has(idx)) return;
          if (!patches[rec.section]) patches[rec.section] = {};
          // Handle nested fields like "weights.aiSuitability"
          const parts = rec.field.split(".");
          if (parts.length === 2) {
            if (!patches[rec.section][parts[0]]) {
              patches[rec.section][parts[0]] = {};
            }
            (patches[rec.section][parts[0]] as Record<string, unknown>)[parts[1]] = rec.suggestedValue;
          } else {
            patches[rec.section][rec.field] = rec.suggestedValue;
          }
        });

        for (const [section, data] of Object.entries(patches)) {
          await saveSection(section as SectionKey, data);
        }

        // Reload config
        const cfg = await fetchConfig();
        populateFromConfig(cfg);
      }
      toast.success("AI recommendations applied");
      setShowOptPanel(false);
    } catch {
      toast.error("Failed to apply recommendations");
    }
  };

  const scrollToSection = (key: string) => {
    setActiveSection(key);
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ─── Section completion indicator ─────────────────────────────────────────

  const getSectionStatus = (key: string): "complete" | "partial" | "empty" => {
    if (!config) return "empty";
    switch (key) {
      case "company":
        if (company?.companyName && company.contactEmail) return "complete";
        if (company?.companyName || company?.contactEmail) return "partial";
        return "empty";
      case "scanning":
        return scanning?.enabledSources?.length ? "complete" : "empty";
      case "regional":
        return regional?.targetProvinces?.length ? "complete" : "partial";
      case "scoring":
        return "complete"; // Always has defaults
      case "bidding":
        return "complete";
      case "risk":
        return "complete";
      case "fulfillment":
        return "complete";
      case "bidTemplates":
        if (bidTemplates?.defaultIntroduction && bidTemplates.teamDescription) return "complete";
        if (bidTemplates?.defaultIntroduction || bidTemplates?.teamDescription) return "partial";
        return "empty";
      case "winTracking":
        return "complete";
      case "alerts":
        if (alerts?.emailEnabled && alerts.emailAddress) return "complete";
        if (alerts?.emailEnabled) return "partial";
        return "empty";
      case "documents":
        return "complete";
      case "blockers":
        return "complete";
      case "apiKeys":
        return apiKeys?.anthropicKeySet ? "complete" : "partial";
      default:
        return "empty";
    }
  };

  const statusDot = (status: "complete" | "partial" | "empty") => {
    const colors = {
      complete: "bg-green-500",
      partial: "bg-amber-400",
      empty: "bg-gray-300",
    };
    return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />;
  };

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (
    loading ||
    !company || !scanning || !regional || !scoring || !bidding || !risk ||
    !fulfillment || !bidTemplates || !winTracking || !alerts || !documents ||
    !blockers || !apiKeys
  ) {
    return <SettingsSkeleton />;
  }

  // ─── Computed values ──────────────────────────────────────────────────────

  const weightsSum = Math.round(
    (scoring.weights.aiSuitability +
      scoring.weights.contractValue +
      scoring.weights.competitionLevel +
      scoring.weights.timeline +
      scoring.weights.bidComplexity +
      scoring.weights.costReduction) *
      100
  );

  const costSum = Math.round(
    (bidding.costBreakdown.aiCosts +
      bidding.costBreakdown.humanCosts +
      bidding.costBreakdown.infrastructure +
      bidding.costBreakdown.overhead +
      bidding.costBreakdown.qa) *
      100
  );

  const sourceKeys = Object.keys(DATA_SOURCES) as OpportunitySource[];
  const categoryKeys = Object.keys(AI_CATEGORIES) as AICategory[];

  // ═════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-[calc(100vh-4rem)] relative">
      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Sidebar Navigation                                                  */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <aside className="w-[220px] shrink-0 border-r bg-muted/30 overflow-y-auto hidden md:block">
        <div className="p-4 pb-2">
          <h2 className="flex items-center gap-2 font-semibold text-sm">
            <Settings className="h-4 w-4" />
            Settings
          </h2>
        </div>
        <nav className="px-2 pb-4 space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => scrollToSection(s.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1 text-left">{s.label}</span>
                {statusDot(getSectionStatus(s.key))}
              </button>
            );
          })}
        </nav>
        <Separator />
        <div className="p-3">
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleResetAll}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset All Defaults
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar: horizontal scroll */}
      <div className="md:hidden fixed top-[4rem] left-0 right-0 z-20 bg-background border-b">
        <div className="flex overflow-x-auto px-2 py-2 gap-1">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => scrollToSection(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Main Content                                                        */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 md:mt-0 mt-14">
        {/* AI Optimize Banner */}
        <div className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/20 p-2">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Let AI optimize your settings for maximum win rate</h3>
                <p className="text-sm text-purple-100 mt-0.5">
                  Claude analyzes your configuration and suggests data-driven improvements
                </p>
              </div>
            </div>
            <Button
              onClick={handleOptimize}
              disabled={optimizing}
              variant="secondary"
              className="bg-white text-purple-700 hover:bg-purple-50"
            >
              {optimizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing your configuration...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Optimize with AI
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Section 1: Company Profile                                       */}
        {/* ================================================================ */}
        <div id="section-company" ref={(el) => { sectionRefs.current.company = el; }}>
          <Card>
            <SectionHeader
              title="Company Profile"
              description="Your organization details used in bid submissions. Ensure accuracy — this information appears on every proposal."
            />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={company.companyName}
                    onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                    className="bg-muted/50"
                  />
                  <FieldHint>Legal name as registered with CRA</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={company.contactEmail}
                    onChange={(e) => setCompany({ ...company, contactEmail: e.target.value })}
                    className="bg-muted/50"
                  />
                  <FieldHint>Primary contact for bid correspondence</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={company.phone}
                    onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={company.website}
                    onChange={(e) => setCompany({ ...company, website: e.target.value })}
                    className="bg-muted/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  rows={2}
                  value={company.address}
                  onChange={(e) => setCompany({ ...company, address: e.target.value })}
                  className="bg-muted/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="businessNumber">CRA Business Number</Label>
                  <Input
                    id="businessNumber"
                    value={company.businessNumber}
                    onChange={(e) => setCompany({ ...company, businessNumber: e.target.value })}
                    className="bg-muted/50"
                  />
                  <FieldHint>9-digit business number</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pspcSupplierId">PSPC Supplier ID</Label>
                  <Input
                    id="pspcSupplierId"
                    value={company.pspcSupplierId}
                    onChange={(e) => setCompany({ ...company, pspcSupplierId: e.target.value })}
                    className="bg-muted/50"
                  />
                  <FieldHint>SAP Ariba supplier ID</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pbn">Procurement Business Number</Label>
                  <Input
                    id="pbn"
                    value={company.pbn}
                    onChange={(e) => setCompany({ ...company, pbn: e.target.value })}
                    className="bg-muted/50"
                  />
                  <FieldHint>PBN for CanadaBuys</FieldHint>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="securityClearance">Security Clearance</Label>
                <Select
                  value={company.securityClearanceLevel}
                  onValueChange={(v) => setCompany({ ...company, securityClearanceLevel: v })}
                >
                  <SelectTrigger id="securityClearance" className="w-full sm:w-[260px] bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="reliability">Reliability</SelectItem>
                    <SelectItem value="secret">Secret</SelectItem>
                    <SelectItem value="top_secret">Top Secret</SelectItem>
                  </SelectContent>
                </Select>
                <FieldHint>Highest clearance level held by your organization</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="aboutUs">About Us / Company Profile</Label>
                <Textarea
                  id="aboutUs"
                  rows={5}
                  value={company.aboutUs}
                  onChange={(e) => setCompany({ ...company, aboutUs: e.target.value })}
                  className="bg-muted/50"
                />
                <FieldHint>Default company description inserted into bid proposals</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label>Capabilities</Label>
                <TagInput
                  tags={company.capabilities}
                  onChange={(caps) => setCompany({ ...company, capabilities: caps })}
                  placeholder="Add a capability and press Enter"
                />
                <FieldHint>Core services your team can deliver</FieldHint>
              </div>

              <SectionFooter
                section="company"
                saving={savingSection === "company"}
                onSave={() => handleSave("company")}
                onReset={() => handleResetSection("company")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 2: Scanning & Filters                                    */}
        {/* ================================================================ */}
        <div id="section-scanning" ref={(el) => { sectionRefs.current.scanning = el; }}>
          <Card>
            <SectionHeader
              title="Scanning & Filters"
              description="Control which opportunities appear in your inbox. Tighter filters mean fewer but more relevant results."
            />
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="minAiScore">Min AI Score (0-100)</Label>
                  <Input
                    id="minAiScore"
                    type="number"
                    min={0}
                    max={100}
                    value={scanning.minAiScore}
                    onChange={(e) => setScanning({ ...scanning, minAiScore: Number(e.target.value) })}
                    className="bg-muted/50"
                  />
                  <FieldHint>Recommended: 70-85. Lower shows more results.</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="minContractValue">Min Contract Value</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="minContractValue"
                      type="number"
                      min={0}
                      value={scanning.minContractValue}
                      onChange={(e) => setScanning({ ...scanning, minContractValue: Number(e.target.value) })}
                      className="bg-muted/50 pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxContractValue">Max Contract Value</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="maxContractValue"
                      type="number"
                      min={0}
                      value={scanning.maxContractValue}
                      onChange={(e) => setScanning({ ...scanning, maxContractValue: Number(e.target.value) })}
                      className="bg-muted/50 pl-7"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scanInterval">Scan Interval (hours)</Label>
                <Input
                  id="scanInterval"
                  type="number"
                  min={1}
                  value={scanning.scanIntervalHours}
                  onChange={(e) => setScanning({ ...scanning, scanIntervalHours: Number(e.target.value) })}
                  className="bg-muted/50 w-32"
                />
                <FieldHint>How often to check for new opportunities. Vercel cron runs every 2h by default.</FieldHint>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Enabled Sources</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {sourceKeys.map((key) => {
                    const checked = scanning.enabledSources.includes(key);
                    const source = DATA_SOURCES[key];
                    return (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? scanning.enabledSources.filter((s) => s !== key)
                              : [...scanning.enabledSources, key];
                            setScanning({ ...scanning, enabledSources: next });
                          }}
                          className="rounded border-gray-300"
                        />
                        <span>{source.name}</span>
                        {source.status !== "live" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {source.status === "planned" ? "Planned" : "Soon"}
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Enabled Categories</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {categoryKeys.map((key) => {
                    const checked = scanning.enabledCategories.includes(key);
                    return (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? scanning.enabledCategories.filter((c) => c !== key)
                              : [...scanning.enabledCategories, key];
                            setScanning({ ...scanning, enabledCategories: next });
                          }}
                          className="rounded border-gray-300"
                        />
                        {AI_CATEGORIES[key].label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label>Excluded Departments</Label>
                <TagInput
                  tags={scanning.excludeDepartments}
                  onChange={(v) => setScanning({ ...scanning, excludeDepartments: v })}
                  placeholder="Type a department name and press Enter"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Excluded Keywords</Label>
                <TagInput
                  tags={scanning.excludeKeywords}
                  onChange={(v) => setScanning({ ...scanning, excludeKeywords: v })}
                  placeholder="Type a keyword and press Enter"
                />
                <FieldHint>Tenders with these words in the title will be hidden</FieldHint>
              </div>

              <SectionFooter
                section="scanning"
                saving={savingSection === "scanning"}
                onSave={() => handleSave("scanning")}
                onReset={() => handleResetSection("scanning")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 3: Regional Preferences                                  */}
        {/* ================================================================ */}
        <div id="section-regional" ref={(el) => { sectionRefs.current.regional = el; }}>
          <Card>
            <SectionHeader
              title="Regional Preferences"
              description="Target specific regions and jurisdictions. Focusing your scope improves relevance and win rates."
            />
            <CardContent className="space-y-6">
              <div className="space-y-1.5">
                <Label>Primary Region</Label>
                <Select
                  value={regional.primaryRegion}
                  onValueChange={(v) => setRegional({ ...regional, primaryRegion: v as "canada" | "usa" | "both" })}
                >
                  <SelectTrigger className="w-full sm:w-[260px] bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="canada">Canada</SelectItem>
                    <SelectItem value="usa">United States</SelectItem>
                    <SelectItem value="both">Both (Canada + USA)</SelectItem>
                  </SelectContent>
                </Select>
                <FieldHint>Controls which data sources are prioritized</FieldHint>
              </div>

              <div className="space-y-2">
                <Label>Target Provinces / States</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROVINCES.map((prov) => {
                    const checked = regional.targetProvinces.includes(prov);
                    return (
                      <label key={prov} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? regional.targetProvinces.filter((p) => p !== prov)
                              : [...regional.targetProvinces, prov];
                            setRegional({ ...regional, targetProvinces: next });
                          }}
                          className="rounded border-gray-300"
                        />
                        {prov}
                      </label>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Federal Only</p>
                  <FieldHint>Skip provincial and municipal contracts</FieldHint>
                </div>
                <Switch
                  checked={regional.federalOnly}
                  onCheckedChange={(v) => setRegional({ ...regional, federalOnly: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Prefer Bilingual Contracts</p>
                  <FieldHint>Boost scoring for EN/FR bilingual requirements</FieldHint>
                </div>
                <Switch
                  checked={regional.preferBilingual}
                  onCheckedChange={(v) => setRegional({ ...regional, preferBilingual: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Exclude Remote Regions</p>
                  <FieldHint>Skip territories (NWT, Nunavut, Yukon) and remote-only postings</FieldHint>
                </div>
                <Switch
                  checked={regional.excludeRemoteRegions}
                  onCheckedChange={(v) => setRegional({ ...regional, excludeRemoteRegions: v })}
                />
              </div>

              <SectionFooter
                section="regional"
                saving={savingSection === "regional"}
                onSave={() => handleSave("regional")}
                onReset={() => handleResetSection("regional")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 4: Scoring Weights                                       */}
        {/* ================================================================ */}
        <div id="section-scoring" ref={(el) => { sectionRefs.current.scoring = el; }}>
          <Card>
            <SectionHeader
              title="Scoring Weights"
              description="Adjust how opportunities are ranked. Weights must sum to 100%. Higher AI suitability weight prioritizes contracts where your AI-powered delivery excels."
            />
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {([
                  ["aiSuitability", "AI Suitability", "How well AI can deliver this contract type"],
                  ["contractValue", "Contract Value", "Higher value contracts score higher"],
                  ["competitionLevel", "Competition Level", "Fewer competitors = higher score"],
                  ["timeline", "Timeline", "Contracts with comfortable timelines"],
                  ["bidComplexity", "Bid Complexity", "Simpler bids are less costly to prepare"],
                  ["costReduction", "Cost Reduction", "Potential for AI cost savings"],
                ] as const).map(([key, label, hint]) => (
                  <div key={key} className="flex items-center gap-4">
                    <Label className="w-40 text-sm shrink-0">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(scoring.weights[key] * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        setScoring({
                          ...scoring,
                          weights: { ...scoring.weights, [key]: val },
                        });
                      }}
                      className="bg-muted/50 w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">{hint}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Total:</span>
                  <span
                    className={`text-sm font-bold ${
                      weightsSum === 100 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {weightsSum}%
                  </span>
                  {weightsSum !== 100 && (
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Must equal 100%
                    </span>
                  )}
                </div>

                {/* Visual weight bar */}
                <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                  <div className="bg-violet-500" style={{ width: `${scoring.weights.aiSuitability * 100}%` }} title="AI Suitability" />
                  <div className="bg-green-500" style={{ width: `${scoring.weights.contractValue * 100}%` }} title="Contract Value" />
                  <div className="bg-blue-500" style={{ width: `${scoring.weights.competitionLevel * 100}%` }} title="Competition" />
                  <div className="bg-amber-500" style={{ width: `${scoring.weights.timeline * 100}%` }} title="Timeline" />
                  <div className="bg-pink-500" style={{ width: `${scoring.weights.bidComplexity * 100}%` }} title="Complexity" />
                  <div className="bg-teal-500" style={{ width: `${scoring.weights.costReduction * 100}%` }} title="Cost Reduction" />
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" />AI</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />Value</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />Competition</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Timeline</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-pink-500" />Complexity</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-500" />Cost Red.</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-semibold">Score Thresholds</Label>
                <FieldHint>Opportunities are color-coded based on these thresholds</FieldHint>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="thresholdHigh" className="text-sm flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> High (green)
                    </Label>
                    <Input
                      id="thresholdHigh"
                      type="number"
                      min={0}
                      max={100}
                      value={scoring.scoreThresholds.high}
                      onChange={(e) =>
                        setScoring({
                          ...scoring,
                          scoreThresholds: { ...scoring.scoreThresholds, high: Number(e.target.value) },
                        })
                      }
                      className="bg-muted/50 w-24"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="thresholdMedium" className="text-sm flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Medium (amber)
                    </Label>
                    <Input
                      id="thresholdMedium"
                      type="number"
                      min={0}
                      max={100}
                      value={scoring.scoreThresholds.medium}
                      onChange={(e) =>
                        setScoring({
                          ...scoring,
                          scoreThresholds: { ...scoring.scoreThresholds, medium: Number(e.target.value) },
                        })
                      }
                      className="bg-muted/50 w-24"
                    />
                  </div>
                </div>
                <FieldHint>Below medium threshold = red (low priority)</FieldHint>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-semibold">Urgency Days</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="urgCritical" className="text-sm flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Critical
                    </Label>
                    <Input
                      id="urgCritical"
                      type="number"
                      min={1}
                      value={scoring.urgencyDays.critical}
                      onChange={(e) =>
                        setScoring({
                          ...scoring,
                          urgencyDays: { ...scoring.urgencyDays, critical: Number(e.target.value) },
                        })
                      }
                      className="bg-muted/50 w-24"
                    />
                    <FieldHint>days</FieldHint>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="urgWarning" className="text-sm flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Warning
                    </Label>
                    <Input
                      id="urgWarning"
                      type="number"
                      min={1}
                      value={scoring.urgencyDays.warning}
                      onChange={(e) =>
                        setScoring({
                          ...scoring,
                          urgencyDays: { ...scoring.urgencyDays, warning: Number(e.target.value) },
                        })
                      }
                      className="bg-muted/50 w-24"
                    />
                    <FieldHint>days</FieldHint>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="urgApproaching" className="text-sm">Approaching</Label>
                    <Input
                      id="urgApproaching"
                      type="number"
                      min={1}
                      value={scoring.urgencyDays.approaching}
                      onChange={(e) =>
                        setScoring({
                          ...scoring,
                          urgencyDays: { ...scoring.urgencyDays, approaching: Number(e.target.value) },
                        })
                      }
                      className="bg-muted/50 w-24"
                    />
                    <FieldHint>days</FieldHint>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="maxCompetitors">Max Competitors Baseline</Label>
                <Input
                  id="maxCompetitors"
                  type="number"
                  min={1}
                  value={scoring.maxCompetitors}
                  onChange={(e) => setScoring({ ...scoring, maxCompetitors: Number(e.target.value) })}
                  className="bg-muted/50 w-24"
                />
                <FieldHint>Used to normalize the competition score. Typical: 20-30.</FieldHint>
              </div>

              <SectionFooter
                section="scoring"
                saving={savingSection === "scoring"}
                onSave={() => handleSave("scoring")}
                onReset={() => handleResetSection("scoring")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 5: Bidding Strategy                                      */}
        {/* ================================================================ */}
        <div id="section-bidding" ref={(el) => { sectionRefs.current.bidding = el; }}>
          <Card>
            <SectionHeader
              title="Bidding Strategy"
              description="Configure pricing defaults and auto-bid behavior. The default bid percentage is your starting price as a fraction of the estimated contract value."
            />
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="defaultBidPercent">Default Bid % of Estimate</Label>
                  <div className="relative">
                    <Input
                      id="defaultBidPercent"
                      type="number"
                      min={1}
                      max={100}
                      value={bidding.defaultBidPercent}
                      onChange={(e) => setBidding({ ...bidding, defaultBidPercent: Number(e.target.value) })}
                      className="bg-muted/50 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  <FieldHint>Recommended: 75-85%. Lower = more competitive.</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="minBidPercent">Min Bid %</Label>
                  <div className="relative">
                    <Input
                      id="minBidPercent"
                      type="number"
                      min={1}
                      max={100}
                      value={bidding.minBidPercent}
                      onChange={(e) => setBidding({ ...bidding, minBidPercent: Number(e.target.value) })}
                      className="bg-muted/50 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  <FieldHint>Floor — never bid below this</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxBidPercent">Max Bid %</Label>
                  <div className="relative">
                    <Input
                      id="maxBidPercent"
                      type="number"
                      min={1}
                      max={100}
                      value={bidding.maxBidPercent}
                      onChange={(e) => setBidding({ ...bidding, maxBidPercent: Number(e.target.value) })}
                      className="bg-muted/50 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  <FieldHint>Ceiling — never bid above this</FieldHint>
                </div>
              </div>

              {/* Visual bid range bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                <div className="relative h-4 rounded-full bg-muted overflow-hidden">
                  <div
                    className="absolute h-full bg-green-200"
                    style={{
                      left: `${bidding.minBidPercent}%`,
                      width: `${bidding.maxBidPercent - bidding.minBidPercent}%`,
                    }}
                  />
                  <div
                    className="absolute h-full w-1 bg-primary rounded"
                    style={{ left: `${bidding.defaultBidPercent}%` }}
                    title={`Default: ${bidding.defaultBidPercent}%`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Min: {bidding.minBidPercent}%</span>
                  <span className="font-medium text-foreground">Default: {bidding.defaultBidPercent}%</span>
                  <span>Max: {bidding.maxBidPercent}%</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto-Bid</p>
                    <FieldHint>Automatically draft bids for high-scoring opportunities</FieldHint>
                  </div>
                  <Switch
                    checked={bidding.autoBidEnabled}
                    onCheckedChange={(v) => setBidding({ ...bidding, autoBidEnabled: v })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="autoBidMinScore">Auto-Bid Min Score</Label>
                    <Input
                      id="autoBidMinScore"
                      type="number"
                      min={0}
                      max={100}
                      disabled={!bidding.autoBidEnabled}
                      value={bidding.autoBidMinScore}
                      onChange={(e) => setBidding({ ...bidding, autoBidMinScore: Number(e.target.value) })}
                      className="bg-muted/50"
                    />
                    <FieldHint>Only auto-bid when score is above this</FieldHint>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="maxAutoBids">Max Auto-Bids Per Week</Label>
                    <Input
                      id="maxAutoBids"
                      type="number"
                      min={1}
                      disabled={!bidding.autoBidEnabled}
                      value={bidding.maxAutoBidsPerWeek}
                      onChange={(e) => setBidding({ ...bidding, maxAutoBidsPerWeek: Number(e.target.value) })}
                      className="bg-muted/50"
                    />
                    <FieldHint>Safety cap to control API costs</FieldHint>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Cost Breakdown</Label>
                  <span
                    className={`text-xs font-medium ${
                      costSum === 100 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    (Total: {costSum}%)
                  </span>
                </div>
                <FieldHint>How your delivery costs are allocated. Must sum to 100%.</FieldHint>
                {([
                  ["aiCosts", "AI Costs %"],
                  ["humanCosts", "Human Costs %"],
                  ["infrastructure", "Infrastructure %"],
                  ["overhead", "Overhead %"],
                  ["qa", "QA %"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-4">
                    <Label className="w-36 text-sm shrink-0">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(bidding.costBreakdown[key] * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        setBidding({
                          ...bidding,
                          costBreakdown: { ...bidding.costBreakdown, [key]: val },
                        });
                      }}
                      className="bg-muted/50 w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                ))}

                {/* Mini pie chart text */}
                <div className="text-xs text-muted-foreground">
                  AI {Math.round(bidding.costBreakdown.aiCosts * 100)}% | Human {Math.round(bidding.costBreakdown.humanCosts * 100)}% | Infra {Math.round(bidding.costBreakdown.infrastructure * 100)}% | Overhead {Math.round(bidding.costBreakdown.overhead * 100)}% | QA {Math.round(bidding.costBreakdown.qa * 100)}%
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="defaultCostReduction">Default Cost Reduction %</Label>
                <div className="relative w-32">
                  <Input
                    id="defaultCostReduction"
                    type="number"
                    min={0}
                    max={100}
                    value={bidding.defaultCostReduction}
                    onChange={(e) => setBidding({ ...bidding, defaultCostReduction: Number(e.target.value) })}
                    className="bg-muted/50 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
                <FieldHint>Assumed AI-driven cost savings vs. traditional delivery</FieldHint>
              </div>

              <SectionFooter
                section="bidding"
                saving={savingSection === "bidding"}
                onSave={() => handleSave("bidding")}
                onReset={() => handleResetSection("bidding")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 6: Risk Management                                       */}
        {/* ================================================================ */}
        <div id="section-risk" ref={(el) => { sectionRefs.current.risk = el; }}>
          <Card>
            <SectionHeader
              title="Risk Management"
              description="Control your bidding appetite and set guardrails. Conservative settings mean fewer but safer bids."
            />
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Risk Tolerance</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    ["conservative", "Conservative", "Bid on fewer, safer contracts. Lower volume, higher win rate."],
                    ["moderate", "Moderate", "Balanced approach. Standard bidding strategy."],
                    ["aggressive", "Aggressive", "Bid on everything above threshold. Higher volume, lower win rate."],
                  ] as const).map(([value, label, desc]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRisk({ ...risk, riskTolerance: value })}
                      className={`rounded-lg border-2 p-4 text-left transition-colors ${
                        risk.riskTolerance === value
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`h-3 w-3 rounded-full ${
                          risk.riskTolerance === value ? "bg-primary" : "bg-muted-foreground/30"
                        }`} />
                        <span className="font-medium text-sm">{label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="maxActiveContracts">Max Active Contracts</Label>
                  <Input
                    id="maxActiveContracts"
                    type="number"
                    min={1}
                    value={risk.maxActiveContracts}
                    onChange={(e) => setRisk({ ...risk, maxActiveContracts: Number(e.target.value) })}
                    className="bg-muted/50 w-24"
                  />
                  <FieldHint>Capacity limit — pause bidding when this is reached</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxMonthlyBidSpend">Monthly API Budget</Label>
                  <div className="relative w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="maxMonthlyBidSpend"
                      type="number"
                      min={0}
                      value={risk.maxMonthlyBidSpend}
                      onChange={(e) => setRisk({ ...risk, maxMonthlyBidSpend: Number(e.target.value) })}
                      className="bg-muted/50 pl-7"
                    />
                  </div>
                  <FieldHint>Max spend on Claude API calls per month</FieldHint>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="minDaysBeforeClosing">Min Days Before Closing</Label>
                  <Input
                    id="minDaysBeforeClosing"
                    type="number"
                    min={1}
                    value={risk.minDaysBeforeClosing}
                    onChange={(e) => setRisk({ ...risk, minDaysBeforeClosing: Number(e.target.value) })}
                    className="bg-muted/50 w-24"
                  />
                  <FieldHint>Skip tenders closing in fewer than this many days</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxBidValueWithoutReview">Max Bid Value Without Review</Label>
                  <div className="relative w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="maxBidValueWithoutReview"
                      type="number"
                      min={0}
                      value={risk.maxBidValueWithoutReview}
                      onChange={(e) => setRisk({ ...risk, maxBidValueWithoutReview: Number(e.target.value) })}
                      className="bg-muted/50 pl-7"
                    />
                  </div>
                  <FieldHint>Auto-approve bids under this amount</FieldHint>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Require Insurance for Bids</p>
                  <FieldHint>Skip tenders requiring professional insurance if you do not have it</FieldHint>
                </div>
                <Switch
                  checked={risk.requireInsuranceForBids}
                  onCheckedChange={(v) => setRisk({ ...risk, requireInsuranceForBids: v })}
                />
              </div>

              <SectionFooter
                section="risk"
                saving={savingSection === "risk"}
                onSave={() => handleSave("risk")}
                onReset={() => handleResetSection("risk")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 7: Fulfillment                                           */}
        {/* ================================================================ */}
        <div id="section-fulfillment" ref={(el) => { sectionRefs.current.fulfillment = el; }}>
          <Card>
            <SectionHeader
              title="Fulfillment"
              description="AI delivery pipeline configuration. Multi-pass processing improves quality but increases API costs."
            />
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Multi-Pass Pipeline</p>
                  <FieldHint>Run multiple quality passes on generated deliverables</FieldHint>
                </div>
                <Switch
                  checked={fulfillment.multiPassEnabled}
                  onCheckedChange={(v) => setFulfillment({ ...fulfillment, multiPassEnabled: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="numberOfPasses">Number of Passes</Label>
                <Select
                  value={String(fulfillment.numberOfPasses)}
                  onValueChange={(v) => setFulfillment({ ...fulfillment, numberOfPasses: Number(v) })}
                  disabled={!fulfillment.multiPassEnabled}
                >
                  <SelectTrigger id="numberOfPasses" className="w-32 bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
                <FieldHint>More passes = higher quality, higher cost. 3-4 recommended.</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="claudeModel">Claude Model</Label>
                <Select
                  value={fulfillment.claudeModel}
                  onValueChange={(v) => setFulfillment({ ...fulfillment, claudeModel: v })}
                >
                  <SelectTrigger id="claudeModel" className="w-full sm:w-[320px] bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                    <SelectItem value="claude-opus-4-20250514">Claude Opus 4</SelectItem>
                    <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5</SelectItem>
                  </SelectContent>
                </Select>
                <FieldHint>Opus = highest quality but most expensive. Sonnet is recommended for most uses.</FieldHint>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="maxTokens">Max Tokens</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min={1000}
                    value={fulfillment.maxTokens}
                    onChange={(e) => setFulfillment({ ...fulfillment, maxTokens: Number(e.target.value) })}
                    className="bg-muted/50"
                  />
                  <FieldHint>Max tokens per API call. 8000 covers most proposals.</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="readingLevel">Target Reading Level</Label>
                  <Input
                    id="readingLevel"
                    type="number"
                    min={1}
                    max={20}
                    value={fulfillment.targetReadingLevel}
                    onChange={(e) =>
                      setFulfillment({ ...fulfillment, targetReadingLevel: Number(e.target.value) })
                    }
                    className="bg-muted/50"
                  />
                  <FieldHint>Flesch-Kincaid grade level. 8 = accessible to most readers.</FieldHint>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Require Human Review</p>
                  <FieldHint>Must review deliverables before marking as delivered</FieldHint>
                </div>
                <Switch
                  checked={fulfillment.requireHumanReview}
                  onCheckedChange={(v) => setFulfillment({ ...fulfillment, requireHumanReview: v })}
                />
              </div>

              <SectionFooter
                section="fulfillment"
                saving={savingSection === "fulfillment"}
                onSave={() => handleSave("fulfillment")}
                onReset={() => handleResetSection("fulfillment")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 8: Bid Templates                                         */}
        {/* ================================================================ */}
        <div id="section-bidTemplates" ref={(el) => { sectionRefs.current.bidTemplates = el; }}>
          <Card>
            <SectionHeader
              title="Bid Templates"
              description="Default content blocks inserted into AI-generated proposals. Having strong templates dramatically improves bid quality."
            />
            <CardContent className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="defaultIntro">Default Introduction</Label>
                <Textarea
                  id="defaultIntro"
                  rows={4}
                  value={bidTemplates.defaultIntroduction}
                  onChange={(e) => setBidTemplates({ ...bidTemplates, defaultIntroduction: e.target.value })}
                  className="bg-muted/50"
                />
                <FieldHint>Standard opening paragraph for proposals. AI will adapt this to each tender.</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="defaultClosing">Default Closing</Label>
                <Textarea
                  id="defaultClosing"
                  rows={3}
                  value={bidTemplates.defaultClosing}
                  onChange={(e) => setBidTemplates({ ...bidTemplates, defaultClosing: e.target.value })}
                  className="bg-muted/50"
                />
                <FieldHint>Standard closing paragraph for proposals</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="teamDescription">Team Description</Label>
                <Textarea
                  id="teamDescription"
                  rows={4}
                  value={bidTemplates.teamDescription}
                  onChange={(e) => setBidTemplates({ ...bidTemplates, teamDescription: e.target.value })}
                  className="bg-muted/50"
                />
                <FieldHint>Description of your team and organization for the &quot;About Us&quot; section</FieldHint>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label>Past Performance</Label>
                <TagInput
                  tags={bidTemplates.pastPerformance}
                  onChange={(v) => setBidTemplates({ ...bidTemplates, pastPerformance: v })}
                  placeholder="Add a past performance summary and press Enter"
                />
                <FieldHint>One-line summaries of past contract performance (e.g. &quot;Delivered PSPC translation project, $50K, on time&quot;)</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label>Certifications</Label>
                <TagInput
                  tags={bidTemplates.certifications}
                  onChange={(v) => setBidTemplates({ ...bidTemplates, certifications: v })}
                  placeholder="Add a certification (e.g. ISO 27001) and press Enter"
                />
                <FieldHint>ISO, CMMI, SOC 2, or other relevant certifications</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label>Differentiators</Label>
                <TagInput
                  tags={bidTemplates.differentiators}
                  onChange={(v) => setBidTemplates({ ...bidTemplates, differentiators: v })}
                  placeholder="Add a key selling point and press Enter"
                />
                <FieldHint>Key competitive advantages highlighted in proposals</FieldHint>
              </div>

              <SectionFooter
                section="bidTemplates"
                saving={savingSection === "bidTemplates"}
                onSave={() => handleSave("bidTemplates")}
                onReset={() => handleResetSection("bidTemplates")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 9: Win Tracking                                          */}
        {/* ================================================================ */}
        <div id="section-winTracking" ref={(el) => { sectionRefs.current.winTracking = el; }}>
          <Card>
            <SectionHeader
              title="Win Tracking"
              description="Track bid outcomes and use data to improve future performance. The feedback loop adjusts scoring weights based on which bids you actually win."
            />
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Track Win/Loss</p>
                  <FieldHint>Enable win/loss tracking for all submitted bids</FieldHint>
                </div>
                <Switch
                  checked={winTracking.trackWinLoss}
                  onCheckedChange={(v) => setWinTracking({ ...winTracking, trackWinLoss: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-Save Winning Templates</p>
                  <FieldHint>Automatically save winning bids as templates for future use</FieldHint>
                </div>
                <Switch
                  checked={winTracking.autoSaveWinningTemplates}
                  onCheckedChange={(v) => setWinTracking({ ...winTracking, autoSaveWinningTemplates: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Feedback Loop</p>
                  <FieldHint>Automatically adjust scoring weights based on which bids you win. Requires win/loss tracking to be enabled.</FieldHint>
                </div>
                <Switch
                  checked={winTracking.feedbackLoopEnabled}
                  onCheckedChange={(v) => setWinTracking({ ...winTracking, feedbackLoopEnabled: v })}
                  disabled={!winTracking.trackWinLoss}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="targetWinRate">Target Win Rate</Label>
                  <div className="relative w-32">
                    <Input
                      id="targetWinRate"
                      type="number"
                      min={1}
                      max={100}
                      value={winTracking.targetWinRate}
                      onChange={(e) => setWinTracking({ ...winTracking, targetWinRate: Number(e.target.value) })}
                      className="bg-muted/50 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  <FieldHint>Realistic goal: 20-35% for government contracts</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="targetMonthlyRevenue">Target Monthly Revenue</Label>
                  <div className="relative w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="targetMonthlyRevenue"
                      type="number"
                      min={0}
                      value={winTracking.targetMonthlyRevenue}
                      onChange={(e) => setWinTracking({ ...winTracking, targetMonthlyRevenue: Number(e.target.value) })}
                      className="bg-muted/50 pl-7"
                    />
                  </div>
                  <FieldHint>Revenue goal used to calculate required pipeline size</FieldHint>
                </div>
              </div>

              <SectionFooter
                section="winTracking"
                saving={savingSection === "winTracking"}
                onSave={() => handleSave("winTracking")}
                onReset={() => handleResetSection("winTracking")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 10: Alerts & Notifications                               */}
        {/* ================================================================ */}
        <div id="section-alerts" ref={(el) => { sectionRefs.current.alerts = el; }}>
          <Card>
            <SectionHeader
              title="Alerts & Notifications"
              description="Get notified when high-scoring opportunities appear. Never miss a deadline on a contract that matches your profile."
            />
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email Alerts</p>
                  <FieldHint>Receive email notifications for matching opportunities</FieldHint>
                </div>
                <Switch
                  checked={alerts.emailEnabled}
                  onCheckedChange={(v) => setAlerts({ ...alerts, emailEnabled: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="alertEmail">Email Address</Label>
                <Input
                  id="alertEmail"
                  type="email"
                  disabled={!alerts.emailEnabled}
                  value={alerts.emailAddress}
                  onChange={(e) => setAlerts({ ...alerts, emailAddress: e.target.value })}
                  className="bg-muted/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slackWebhook">Slack Webhook URL</Label>
                <Input
                  id="slackWebhook"
                  value={alerts.slackWebhookUrl}
                  onChange={(e) => setAlerts({ ...alerts, slackWebhookUrl: e.target.value })}
                  placeholder="https://hooks.slack.com/services/..."
                  className="bg-muted/50"
                />
                <FieldHint>Optional: receive alerts in a Slack channel</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="alertMinScore">Alert Min Score (0-100)</Label>
                <Input
                  id="alertMinScore"
                  type="number"
                  min={0}
                  max={100}
                  value={alerts.alertMinScore}
                  onChange={(e) => setAlerts({ ...alerts, alertMinScore: Number(e.target.value) })}
                  className="bg-muted/50 w-32"
                />
                <FieldHint>Only alert when score is at or above this threshold</FieldHint>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Alert Categories</Label>
                <FieldHint>Select which categories trigger alerts</FieldHint>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {categoryKeys.map((key) => {
                    const checked = alerts.alertCategories.includes(key);
                    return (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? alerts.alertCategories.filter((c) => c !== key)
                              : [...alerts.alertCategories, key];
                            setAlerts({ ...alerts, alertCategories: next });
                          }}
                          className="rounded border-gray-300"
                        />
                        {AI_CATEGORIES[key].label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Daily Digest</p>
                  <FieldHint>Receive a daily summary email of new opportunities</FieldHint>
                </div>
                <Switch
                  checked={alerts.digestEnabled}
                  onCheckedChange={(v) => setAlerts({ ...alerts, digestEnabled: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="digestTime">Digest Time</Label>
                <Input
                  id="digestTime"
                  type="time"
                  disabled={!alerts.digestEnabled}
                  value={alerts.digestTime}
                  onChange={(e) => setAlerts({ ...alerts, digestTime: e.target.value })}
                  className="bg-muted/50 w-40"
                />
              </div>

              <SectionFooter
                section="alerts"
                saving={savingSection === "alerts"}
                onSave={() => handleSave("alerts")}
                onReset={() => handleResetSection("alerts")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 11: Documents                                            */}
        {/* ================================================================ */}
        <div id="section-documents" ref={(el) => { sectionRefs.current.documents = el; }}>
          <Card>
            <SectionHeader
              title="Documents"
              description="Default formatting for exported proposals and reports. These settings control the appearance of generated PDFs and DOCX files."
            />
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="docFont">Font</Label>
                  <Select
                    value={documents.font}
                    onValueChange={(v) => setDocuments({ ...documents, font: v })}
                  >
                    <SelectTrigger id="docFont" className="bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Calibri">Calibri</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldHint>Calibri is standard for government proposals</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bodySize">Body Font Size (pt)</Label>
                  <Input
                    id="bodySize"
                    type="number"
                    min={8}
                    max={24}
                    value={documents.bodySize}
                    onChange={(e) => setDocuments({ ...documents, bodySize: Number(e.target.value) })}
                    className="bg-muted/50"
                  />
                  <FieldHint>11-12pt is standard</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="headingSize">Heading Font Size (pt)</Label>
                  <Input
                    id="headingSize"
                    type="number"
                    min={10}
                    max={36}
                    value={documents.headingSize}
                    onChange={(e) => setDocuments({ ...documents, headingSize: Number(e.target.value) })}
                    className="bg-muted/50"
                  />
                  <FieldHint>14-16pt is standard for section headings</FieldHint>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="headerText">Header Text</Label>
                <Input
                  id="headerText"
                  value={documents.headerText}
                  onChange={(e) => setDocuments({ ...documents, headerText: e.target.value })}
                  className="bg-muted/50"
                />
                <FieldHint>Appears at the top of every page</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="footerText">Footer Text</Label>
                <Input
                  id="footerText"
                  value={documents.footerText}
                  onChange={(e) => setDocuments({ ...documents, footerText: e.target.value })}
                  className="bg-muted/50"
                />
                <FieldHint>Appears at the bottom of every page</FieldHint>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">CONFIDENTIAL Watermark</p>
                  <FieldHint>Add a CONFIDENTIAL watermark to exported documents</FieldHint>
                </div>
                <Switch
                  checked={documents.includeConfidential}
                  onCheckedChange={(v) => setDocuments({ ...documents, includeConfidential: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Cover Page Logo</p>
                  <FieldHint>Include company logo on the cover page</FieldHint>
                </div>
                <Switch
                  checked={documents.coverPageLogo}
                  onCheckedChange={(v) => setDocuments({ ...documents, coverPageLogo: v })}
                />
              </div>

              <SectionFooter
                section="documents"
                saving={savingSection === "documents"}
                onSave={() => handleSave("documents")}
                onReset={() => handleResetSection("documents")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 12: Blockers                                             */}
        {/* ================================================================ */}
        <div id="section-blockers" ref={(el) => { sectionRefs.current.blockers = el; }}>
          <Card>
            <SectionHeader
              title="Blockers"
              description="Declare your qualifications so blockers are correctly classified as hard (disqualifying) or soft (manageable). This prevents wasting time on contracts you cannot win."
            />
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Has Security Clearance</p>
                  <FieldHint>If enabled, security clearance blockers become soft (non-disqualifying)</FieldHint>
                </div>
                <Switch
                  checked={blockers.hasSecurityClearance}
                  onCheckedChange={(v) => setBlockers({ ...blockers, hasSecurityClearance: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Professional Licenses</Label>
                <FieldHint>Add any professional licenses you hold (e.g. P.Eng, CPA)</FieldHint>
                <TagInput
                  tags={blockers.hasProfessionalLicense}
                  onChange={(v) => setBlockers({ ...blockers, hasProfessionalLicense: v })}
                  placeholder="Type a license and press Enter"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Can Be On-Site</p>
                  <FieldHint>If enabled, physical presence requirements become soft</FieldHint>
                </div>
                <Switch
                  checked={blockers.canBeOnSite}
                  onCheckedChange={(v) => setBlockers({ ...blockers, canBeOnSite: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Is Canadian Citizen</p>
                  <FieldHint>Required for some federal contracts</FieldHint>
                </div>
                <Switch
                  checked={blockers.isCanadianCitizen}
                  onCheckedChange={(v) => setBlockers({ ...blockers, isCanadianCitizen: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Has Professional Insurance</p>
                  <FieldHint>Errors and Omissions / Professional Liability coverage</FieldHint>
                </div>
                <Switch
                  checked={blockers.hasProfessionalInsurance}
                  onCheckedChange={(v) => setBlockers({ ...blockers, hasProfessionalInsurance: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Is Bilingual</p>
                  <FieldHint>English + French delivery capability</FieldHint>
                </div>
                <Switch
                  checked={blockers.isBilingual}
                  onCheckedChange={(v) => setBlockers({ ...blockers, isBilingual: v })}
                />
              </div>

              <SectionFooter
                section="blockers"
                saving={savingSection === "blockers"}
                onSave={() => handleSave("blockers")}
                onReset={() => handleResetSection("blockers")}
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Section 13: API & Connections                                     */}
        {/* ================================================================ */}
        <div id="section-apiKeys" ref={(el) => { sectionRefs.current.apiKeys = el; }}>
          <Card>
            <SectionHeader
              title="API & Connections"
              description="Connection status for external services. Configure API keys in your .env.local file — they are never stored in this settings panel for security."
            />
            <CardContent className="space-y-4">
              {([
                ["Anthropic Claude", apiKeys.anthropicKeySet, "Powers AI classification, bid generation, and optimization"],
                ["Supabase", apiKeys.supabaseConnected, "Database, authentication, and real-time subscriptions"],
                ["Stripe", apiKeys.stripeConnected, "Subscription billing and payment processing"],
                ["Resend", apiKeys.resendConnected, "Transactional email and digest delivery"],
                ["SAM.gov", apiKeys.samGovKeySet, "US federal contract opportunities API"],
                ["MERX", apiKeys.merxSubscribed, "Canadian multi-level procurement feed"],
              ] as const).map(([name, connected, desc]) => (
                <div key={name} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ConnectionBadge connected={connected} />
                    {!connected && (
                      <span className="text-xs text-muted-foreground">Configure in .env.local</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* Bottom Status Bar                                                */}
        {/* ================================================================ */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs font-medium text-muted-foreground">Service Status</span>
            <div className="flex items-center gap-4 text-xs">
              {([
                ["Supabase", apiKeys.supabaseConnected],
                ["Claude", apiKeys.anthropicKeySet],
                ["Stripe", apiKeys.stripeConnected],
                ["Resend", apiKeys.resendConnected],
                ["SAM.gov", apiKeys.samGovKeySet],
                ["MERX", apiKeys.merxSubscribed],
              ] as const).map(([name, ok]) => (
                <span key={name} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-red-400"}`} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* AI Optimization Slide-in Panel                                      */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {showOptPanel && optimization && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/40"
            onClick={() => setShowOptPanel(false)}
          />
          {/* Panel */}
          <div className="w-full max-w-lg bg-background border-l shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-background border-b p-4 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold">AI Recommendations</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowOptPanel(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Strategy summary */}
              <p className="text-sm text-muted-foreground mt-2">{optimization.overallStrategy}</p>

              <div className="flex gap-3 mt-3">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Win Rate: {optimization.estimatedImpact.winRateChange}
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Revenue: {optimization.estimatedImpact.revenueChange}
                </Badge>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {optimization.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 transition-colors ${
                    selectedRecs.has(idx) ? "border-purple-300 bg-purple-50/50" : "border-muted"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedRecs.has(idx)}
                      onChange={() => {
                        const next = new Set(selectedRecs);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        setSelectedRecs(next);
                      }}
                      className="mt-1 rounded border-gray-300"
                    />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{rec.section}</Badge>
                        <span className="text-sm font-medium">{rec.field}</span>
                        <ImpactBadge impact={rec.impact} />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground line-through">
                          {JSON.stringify(rec.currentValue)}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-primary">
                          {JSON.stringify(rec.suggestedValue)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 bg-background border-t p-4 flex gap-2">
              <Button
                onClick={() => handleApplyOptimization(true)}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                <Check className="mr-2 h-4 w-4" />
                Apply All
              </Button>
              <Button
                onClick={() => handleApplyOptimization(false)}
                variant="outline"
                className="flex-1"
                disabled={selectedRecs.size === 0}
              >
                Apply Selected ({selectedRecs.size})
              </Button>
              <Button variant="ghost" onClick={() => setShowOptPanel(false)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
