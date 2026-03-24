"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PRICING_TIERS } from "@/lib/constants";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: string) => {
    if (plan === "free") {
      window.location.href = "/signup";
      return;
    }
    if (plan === "enterprise") {
      window.location.href = "mailto:sales@govbot.ai?subject=Enterprise%20Plan%20Inquiry";
      return;
    }

    setLoading(plan);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (res.status === 401) {
        toast.error("Please log in first", {
          description: "You need an account to subscribe.",
          action: { label: "Log In", onClick: () => window.location.href = "/login" },
        });
      } else {
        toast.error("Checkout failed", { description: data.error || "Please try again." });
      }
    } catch {
      toast.error("Connection error", { description: "Please check your internet connection." });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-3">
          Simple, Transparent Pricing
        </h1>
        <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Start free. Scale as you win contracts. Every plan includes access to
          Canadian government tender data and AI-powered opportunity scoring.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.entries(PRICING_TIERS) as [keyof typeof PRICING_TIERS, typeof PRICING_TIERS[keyof typeof PRICING_TIERS]][]).map(
          ([key, tier]) => {
            const isPopular = key === "pro";
            const isLoading = loading === key;
            return (
              <Card
                key={key}
                className={cn(
                  "relative flex flex-col p-6",
                  isPopular
                    ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10"
                    : "bg-white shadow-sm"
                )}
              >
                {isPopular && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-1">{tier.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold font-mono">
                      ${tier.price}
                    </span>
                    {tier.price > 0 && (
                      <span className="text-sm text-muted-foreground">
                        /month
                      </span>
                    )}
                  </div>
                </div>

                <Separator className="mb-6" />

                <ul className="flex-1 space-y-3 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    "w-full",
                    isPopular
                      ? ""
                      : "bg-muted/50 text-foreground hover:bg-muted border border-border"
                  )}
                  variant={isPopular ? "default" : "outline"}
                  disabled={isLoading}
                  onClick={() => handleSubscribe(key)}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {key === "free"
                    ? "Get Started"
                    : key === "enterprise"
                      ? "Contact Sales"
                      : isLoading
                        ? "Redirecting..."
                        : "Subscribe"}
                </Button>
              </Card>
            );
          }
        )}
      </div>

      <Separator className="my-12" />

      {/* Revenue Streams Section */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">
          Four Revenue Streams, One Platform
        </h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          GovBot AI powers multiple ways to generate revenue from procurement intelligence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center text-xl">
              1
            </div>
            <div>
              <h3 className="font-bold">Win Government Contracts</h3>
              <p className="text-xs text-muted-foreground">
                Federal, provincial, MASH sector
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Scan opportunities, generate AI fulfillment plans, and submit competitive
            bids powered by AI at 40-65% gross margin.
          </p>
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-xl text-emerald-600">
              2
            </div>
            <div>
              <h3 className="font-bold">Private Sector AI Services</h3>
              <p className="text-xs text-muted-foreground">
                B2B retainers and project work
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Offer AI document processing, content creation, and data analysis directly
            to businesses. $4K-$10K/month retainers with near-zero barriers.
          </p>
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center text-xl text-amber-600">
              3
            </div>
            <div>
              <h3 className="font-bold">Bid Writing as a Service</h3>
              <p className="text-xs text-muted-foreground">
                $3K-$15K per proposal
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every tender is monetizable. Use the AI bid generator to write proposals
            for other contractors at near-zero marginal cost.
          </p>
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center text-xl text-purple-600">
              4
            </div>
            <div>
              <h3 className="font-bold">SaaS Platform Licensing</h3>
              <p className="text-xs text-muted-foreground">
                Sell the tool to other contractors
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            License the scanning, scoring, and bid generation platform to the 80%
            of MERX users who are SMEs with &lt;50 employees.
          </p>
        </Card>
      </div>
    </div>
  );
}
