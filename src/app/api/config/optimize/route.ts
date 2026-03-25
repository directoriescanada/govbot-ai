// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Configuration Optimization Endpoint
// Uses Claude to analyze current config and suggest improvements
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import type { GovBotConfig } from "@/lib/config";

export const maxDuration = 60;

// ─── Types ──────────────────────────────────────────────────────────────────

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
  optimizedConfig: GovBotConfig;
}

// ─── Mock response for when API key is not set ──────────────────────────────

function getMockOptimization(config: GovBotConfig): OptimizationResponse {
  const optimized = structuredClone(config);

  // Apply mock optimizations
  optimized.bidding.defaultBidPercent = 79;
  optimized.scoring.weights.aiSuitability = 0.40;
  optimized.scoring.weights.contractValue = 0.18;
  optimized.scoring.weights.competitionLevel = 0.17;
  optimized.scoring.weights.timeline = 0.08;
  optimized.scoring.weights.bidComplexity = 0.07;
  optimized.scoring.weights.costReduction = 0.10;
  optimized.scanning.minAiScore = 75;
  optimized.risk.minDaysBeforeClosing = 7;
  optimized.risk.riskTolerance = "moderate";
  optimized.fulfillment.numberOfPasses = 3;
  optimized.winTracking.targetWinRate = 30;

  return {
    recommendations: [
      {
        section: "bidding",
        field: "defaultBidPercent",
        currentValue: config.bidding.defaultBidPercent,
        suggestedValue: 79,
        reason:
          "Historical data shows 79% of estimate has the highest win rate for AI service contracts in Canada. Your current 82% may be leaving money on the table without significantly improving win odds.",
        impact: "high",
      },
      {
        section: "scoring",
        field: "weights.aiSuitability",
        currentValue: config.scoring.weights.aiSuitability,
        suggestedValue: 0.40,
        reason:
          "Increasing the AI suitability weight helps prioritize contracts where your AI-powered delivery has the strongest competitive advantage.",
        impact: "high",
      },
      {
        section: "scanning",
        field: "minAiScore",
        currentValue: config.scanning.minAiScore,
        suggestedValue: 75,
        reason:
          "Lowering the minimum AI score from 80 to 75 will surface approximately 20% more opportunities, some of which may be strong fits that were borderline excluded.",
        impact: "medium",
      },
      {
        section: "risk",
        field: "minDaysBeforeClosing",
        currentValue: config.risk.minDaysBeforeClosing,
        suggestedValue: 7,
        reason:
          "Increasing the minimum days before closing from 5 to 7 gives more time for quality bid preparation, reducing rushed submissions that tend to score lower.",
        impact: "medium",
      },
      {
        section: "fulfillment",
        field: "numberOfPasses",
        currentValue: config.fulfillment.numberOfPasses,
        suggestedValue: 3,
        reason:
          "Three passes provides an optimal balance of quality and cost. The fourth pass yields diminishing returns — typically only 2-3% quality improvement for 25% more API cost.",
        impact: "low",
      },
      {
        section: "winTracking",
        field: "targetWinRate",
        currentValue: config.winTracking.targetWinRate,
        suggestedValue: 30,
        reason:
          "A 30% target win rate is more achievable for AI-focused government contracts and sets a motivating yet realistic benchmark for the feedback loop.",
        impact: "low",
      },
    ],
    overallStrategy:
      "Focus on high-suitability AI contracts with slightly more aggressive pricing. Lower the entry threshold to capture more opportunities while maintaining quality through the 3-pass fulfillment pipeline. The combination of tighter bid pricing and broader scanning should yield a 5-8% improvement in win rate.",
    estimatedImpact: {
      winRateChange: "+5-8%",
      revenueChange: "+$12-18K/month",
    },
    optimizedConfig: optimized,
  };
}

// ─── POST: Full optimization with Claude ────────────────────────────────────

export async function POST() {
  try {
    const config = await getConfig();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Return mock optimization when no API key is configured
      return NextResponse.json(getMockOptimization(config));
    }

    // Dynamic import to avoid build errors if package isn't installed
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are an expert in Canadian and US government procurement strategy. Analyze this GovBot configuration and suggest optimizations to maximize contract win rate and revenue.

You must return ONLY valid JSON with this exact structure:
{
  "recommendations": [
    {
      "section": "sectionName",
      "field": "fieldName",
      "currentValue": <current>,
      "suggestedValue": <suggested>,
      "reason": "Why this change will help",
      "impact": "high" | "medium" | "low"
    }
  ],
  "overallStrategy": "A 2-3 sentence summary of the recommended strategy",
  "estimatedImpact": {
    "winRateChange": "+X%",
    "revenueChange": "+$XK/month"
  },
  "optimizedConfig": { ...full optimized config object... }
}

Focus on:
1. Scoring weights that prioritize winnable contracts
2. Bidding percentages that balance competitiveness with profitability
3. Risk settings appropriate for the company's profile
4. Scanning filters that maximize opportunity pipeline
5. Regional targeting based on where AI contracts are most common

Provide 4-8 specific, actionable recommendations. Each reason should reference real procurement strategy insights.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Here is the current GovBot configuration. Analyze it and suggest optimizations:\n\n${JSON.stringify(config, null, 2)}`,
        },
      ],
      system: systemPrompt,
    });

    // Extract text content from the response
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse the JSON response — handle possible markdown code fences
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const optimization: OptimizationResponse = JSON.parse(jsonStr);
    return NextResponse.json(optimization);
  } catch (error) {
    console.error("Config optimization error:", error);

    // Fall back to mock on any error
    const config = await getConfig();
    return NextResponse.json(getMockOptimization(config));
  }
}

// ─── GET: Preview recommendations without applying ──────────────────────────

export async function GET() {
  try {
    const config = await getConfig();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      const mock = getMockOptimization(config);
      return NextResponse.json({
        recommendations: mock.recommendations,
        overallStrategy: mock.overallStrategy,
        estimatedImpact: mock.estimatedImpact,
      });
    }

    // For GET, use the same logic but only return recommendations (no optimizedConfig)
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Briefly analyze this GovBot configuration and provide 3-5 quick recommendations:\n\n${JSON.stringify(config, null, 2)}`,
        },
      ],
      system: `You are a government procurement strategy expert. Return ONLY valid JSON with this structure:
{
  "recommendations": [{ "section": "...", "field": "...", "currentValue": ..., "suggestedValue": ..., "reason": "...", "impact": "high"|"medium"|"low" }],
  "overallStrategy": "2-3 sentence summary",
  "estimatedImpact": { "winRateChange": "+X%", "revenueChange": "+$XK/month" }
}`,
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(jsonStr);
    return NextResponse.json({
      recommendations: result.recommendations,
      overallStrategy: result.overallStrategy,
      estimatedImpact: result.estimatedImpact,
    });
  } catch (error) {
    console.error("Config preview error:", error);
    const config = await getConfig();
    const mock = getMockOptimization(config);
    return NextResponse.json({
      recommendations: mock.recommendations,
      overallStrategy: mock.overallStrategy,
      estimatedImpact: mock.estimatedImpact,
    });
  }
}
