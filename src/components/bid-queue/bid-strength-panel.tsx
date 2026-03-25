"use client";

import { X, CheckCircle2, AlertTriangle, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface BidStrengthAnalysis {
  overallScore: number;
  breakdown: {
    compliance: number;
    pricing: number;
    technicalDepth: number;
    differentiators: number;
    riskFactors: number;
  };
  weaknesses: Array<{
    area: string;
    issue: string;
    severity: "critical" | "warning" | "info";
    recommendation: string;
  }>;
  strengths: string[];
  improvementPlan: string[];
}

interface BidStrengthPanelProps {
  analysis: BidStrengthAnalysis | null;
  loading: boolean;
  onClose: () => void;
}

const BREAKDOWN_LABELS: Record<string, string> = {
  compliance: "Compliance",
  pricing: "Pricing",
  technicalDepth: "Technical Depth",
  differentiators: "Differentiators",
  riskFactors: "Risk Factors",
};

const BREAKDOWN_COLORS: Record<string, string> = {
  compliance: "bg-blue-500",
  pricing: "bg-emerald-500",
  technicalDepth: "bg-violet-500",
  differentiators: "bg-amber-500",
  riskFactors: "bg-rose-500",
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-50 border-emerald-200";
  if (score >= 60) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertTriangle className="h-3.5 w-3.5" />,
  warning: <AlertTriangle className="h-3.5 w-3.5" />,
  info: <Info className="h-3.5 w-3.5" />,
};

export function BidStrengthPanel({ analysis, loading, onClose }: BidStrengthPanelProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l border-border shadow-xl overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-5 py-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Bid Strength Analysis
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-5 space-y-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing bid strength...</p>
          </div>
        )}

        {!loading && !analysis && (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">No analysis available.</p>
          </div>
        )}

        {!loading && analysis && (
          <>
            {/* Overall Score */}
            <Card className={`p-5 text-center ${getScoreBgColor(analysis.overallScore)}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Overall Score
              </p>
              <p className={`text-5xl font-extrabold font-mono ${getScoreColor(analysis.overallScore)}`}>
                {analysis.overallScore}
              </p>
              <p className="text-xs text-muted-foreground mt-1">out of 100</p>
            </Card>

            {/* Breakdown */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Breakdown
              </h3>
              <div className="space-y-3">
                {Object.entries(analysis.breakdown).map(([key, value]) => (
                  <div key={key}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        {BREAKDOWN_LABELS[key] || key}
                      </span>
                      <span className={`text-xs font-bold font-mono ${getScoreColor(value)}`}>
                        {value}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${BREAKDOWN_COLORS[key] || "bg-primary"}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weaknesses */}
            {analysis.weaknesses.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Weaknesses
                </h3>
                <div className="space-y-3">
                  {analysis.weaknesses.map((w, i) => (
                    <Card key={i} className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${SEVERITY_STYLES[w.severity]}`}
                        >
                          {SEVERITY_ICONS[w.severity]}
                          <span className="ml-1">{w.severity}</span>
                        </Badge>
                        <span className="text-xs font-semibold">{w.area}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{w.issue}</p>
                      <p className="text-xs text-primary font-medium">
                        Recommendation: {w.recommendation}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths */}
            {analysis.strengths.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Strengths
                </h3>
                <div className="space-y-2">
                  {analysis.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Improvement Plan */}
            {analysis.improvementPlan.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Improvement Plan
                </h3>
                <div className="space-y-2">
                  {analysis.improvementPlan.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-xs text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
