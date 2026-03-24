"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DATA_SOURCES, CANADABUYS_ENDPOINTS } from "@/lib/constants";
import {
  Database,
  Globe,
  Zap,
  Clock,
  ExternalLink,
  CheckCircle2,
  Timer,
  ArrowRight,
} from "lucide-react";

const PIPELINE_STEPS = [
  { num: 1, label: "INGEST", desc: "Cron job downloads CanadaBuys Open Tender CSV every 2 hours" },
  { num: 2, label: "PARSE", desc: "Extract tender descriptions, values, categories, deadlines" },
  { num: 3, label: "CLASSIFY", desc: "Claude API analyzes each tender for AI fulfillability" },
  { num: 4, label: "SCORE", desc: "Composite scoring: AI suitability x value x competition x timeline" },
  { num: 5, label: "STRATEGIZE", desc: "Auto-generate fulfillment plan, cost model, risk assessment" },
  { num: 6, label: "ALERT", desc: "Push notifications for high-scoring opportunities" },
  { num: 7, label: "BID", desc: "AI drafts proposal sections, compliance matrices, pricing" },
];

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Data Source Pipeline</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          GovBot AI ingests procurement data from federal, provincial, MASH sector, US federal,
          and international open data portals. The system downloads, parses, classifies with AI,
          scores, and generates fulfillment strategies for each opportunity.
        </p>
      </div>

      {/* Connected Sources */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Database className="h-4 w-4" />
          Connected Sources
        </h2>
        <div className="space-y-2">
          {Object.entries(DATA_SOURCES).map(([key, source]) => (
            <Card
              key={key}
              className="flex items-center justify-between p-4 bg-white shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">{source.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.url && (
                      <span className="font-mono">{source.url}</span>
                    )}
                    {source.url && " — "}
                    {source.feeds}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="text-[10px]"
                >
                  {source.region}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    source.status === "live"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-500/20"
                      : source.status === "planned"
                        ? "bg-amber-50 text-amber-600 border-amber-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  }
                >
                  {source.status === "live" && (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  )}
                  {source.status === "planned" && (
                    <Timer className="mr-1 h-3 w-3" />
                  )}
                  {source.status === "coming_soon" && (
                    <Clock className="mr-1 h-3 w-3" />
                  )}
                  {source.status.replace("_", " ")}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Pipeline Architecture */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Zap className="h-4 w-4" />
          Data Pipeline Architecture
        </h2>
        <Card className="p-6 bg-white shadow-sm">
          <div className="space-y-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.num} className="flex items-start gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary font-mono text-sm font-bold">
                  {step.num}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-bold text-primary">
                    {step.label}
                  </span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {step.desc}
                  </span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 mt-2 flex-shrink-0 hidden lg:block" />
                )}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Separator className="my-8" />

      {/* Endpoints */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <ExternalLink className="h-4 w-4" />
          Live Data Endpoints
        </h2>
        <Card className="p-5 bg-white shadow-sm space-y-3">
          {Object.entries(CANADABUYS_ENDPOINTS).map(([key, url]) => (
            <div key={key} className="flex items-start gap-3">
              <span className="text-sm font-semibold capitalize min-w-[120px]">
                {key.replace(/([A-Z])/g, " $1").trim()}:
              </span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-primary hover:underline break-all"
              >
                {url}
              </a>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
            All data is available under the Open Government Licence — Canada. Free for commercial use.
            Data refreshes every 2 hours from 6:15am to 10:15pm ET.
          </p>
        </Card>
      </section>

      {/* Market Coverage */}
      <section>
        <h2 className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Globe className="h-4 w-4" />
          Market Coverage
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-5 bg-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Canada Federal
            </p>
            <p className="text-2xl font-extrabold font-mono text-primary">$22B</p>
            <p className="text-xs text-muted-foreground">annual procurement</p>
          </Card>
          <Card className="p-5 bg-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              MASH + Provincial
            </p>
            <p className="text-2xl font-extrabold font-mono text-amber-600">$200B</p>
            <p className="text-xs text-muted-foreground">annual procurement</p>
          </Card>
          <Card className="p-5 bg-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              US Federal (SAM.gov)
            </p>
            <p className="text-2xl font-extrabold font-mono text-emerald-600">$700B</p>
            <p className="text-xs text-muted-foreground">annual procurement</p>
          </Card>
        </div>
      </section>
    </div>
  );
}
