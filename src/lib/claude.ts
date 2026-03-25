// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Claude API Integration
// ═══════════════════════════════════════════════════════════════════

import Anthropic from "@anthropic-ai/sdk";
import { AICategory, AIFulfillmentPlan, BidComplexity, Tender, SubmissionPackage } from "@/types/tender";
import { recommendPrice, PricingRecommendation } from "@/lib/award-intelligence";
import { buildMultiPassPrompts, parsePassResult, PassResult } from "@/lib/multi-pass";
import { getConfigSection } from "@/lib/config";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ClassificationResult {
  aiCategories: AICategory[];
  aiScore: number;
  bidComplexity: BidComplexity;
  competitorEstimate: number;
  fulfillmentPlan: AIFulfillmentPlan;
}

export async function classifyTender(
  title: string,
  description: string,
  department: string,
  estimatedValue: number,
  category: string
): Promise<ClassificationResult> {
  const fulfillmentCfg = await getConfigSection("fulfillment");
  const response = await anthropic.messages.create({
    model: fulfillmentCfg.claudeModel,
    max_tokens: fulfillmentCfg.maxTokens,
    messages: [
      {
        role: "user",
        content: `You are an expert in Canadian government procurement and AI-powered service delivery. Analyze this government tender and classify it for AI fulfillment potential.

TENDER:
Title: ${title}
Description: ${description}
Department: ${department}
Estimated Value: $${estimatedValue.toLocaleString()} CAD
Category: ${category}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "aiCategories": ["CATEGORY1", "CATEGORY2"],
  "aiScore": 85,
  "bidComplexity": "Medium",
  "competitorEstimate": 10,
  "fulfillmentPlan": {
    "approach": "Detailed description of how AI would fulfill this contract...",
    "tools": ["Tool 1", "Tool 2"],
    "humanOversight": "Description of required human oversight...",
    "costReduction": "65%",
    "deliverySpeed": "3x faster than traditional approach",
    "risks": ["Risk 1", "Risk 2"],
    "estimatedAICost": 15000,
    "estimatedHumanCost": 45000
  }
}

VALID CATEGORIES: TRANSLATION, WRITING, DATA_ANALYSIS, TRANSCRIPTION, DOCUMENT_REVIEW, COMMS, TRAINING, SURVEY, IT_CONSULTING, POLICY, AUDIT, TESTING

RULES:
- aiScore: 0-100, how suitable this tender is for AI fulfillment
- bidComplexity: "Low", "Medium", or "High"
- competitorEstimate: estimated number of bidders (1-30)
- Be realistic about AI capabilities — do not overstate
- If this tender cannot be meaningfully fulfilled by AI, give aiScore < 30
- Cost reduction should be realistic (typically 40-80% for suitable tenders)
- Include at least 2 specific risks`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text);
    return {
      aiCategories: parsed.aiCategories || [],
      aiScore: Math.min(Math.max(parsed.aiScore || 0, 0), 100),
      bidComplexity: parsed.bidComplexity || "Medium",
      competitorEstimate: parsed.competitorEstimate || 10,
      fulfillmentPlan: parsed.fulfillmentPlan || null,
    };
  } catch {
    return {
      aiCategories: [],
      aiScore: 0,
      bidComplexity: "High",
      competitorEstimate: 15,
      fulfillmentPlan: {
        approach: "Classification failed — manual review required",
        tools: [],
        humanOversight: "Full manual review needed",
        costReduction: "0%",
        deliverySpeed: "Unknown",
        risks: ["AI classification failed for this tender"],
        estimatedAICost: 0,
        estimatedHumanCost: estimatedValue,
      },
    };
  }
}

export async function generateBidResponse(
  title: string,
  description: string,
  department: string,
  requirements: string,
  estimatedValue: number
): Promise<{
  complianceMatrix: Array<{ requirement: string; section: string; mandatory: boolean; response: string; status: string }>;
  proposalSections: Array<{ title: string; content: string; wordCount: number }>;
  pricingModel: {
    totalBidPrice: number;
    aiCosts: number;
    humanCosts: number;
    infrastructure: number;
    overhead: number;
    margin: number;
    marginPercent: number;
  };
  pricingRecommendation: PricingRecommendation;
}> {
  const recommendation = recommendPrice({ department, category: "", estimatedValue });
  const bidPrice = recommendation.recommendedBidPrice;
  const bidPercent = recommendation.bidAsPercentOfEstimate;

  const fulfillmentCfg2 = await getConfigSection("fulfillment");
  const response = await anthropic.messages.create({
    model: fulfillmentCfg2.claudeModel,
    max_tokens: fulfillmentCfg2.maxTokens,
    messages: [
      {
        role: "user",
        content: `You are an expert government proposal writer specializing in Canadian federal procurement. Generate a comprehensive bid response for this tender.

TENDER:
Title: ${title}
Description: ${description}
Department: ${department}
Estimated Value: $${estimatedValue.toLocaleString()} CAD
Additional Requirements: ${requirements || "None specified"}

Generate a complete bid response as JSON (no markdown, no code fences):
{
  "complianceMatrix": [
    {
      "requirement": "The requirement text",
      "section": "RFP section reference",
      "mandatory": true,
      "response": "How we meet this requirement",
      "status": "met"
    }
  ],
  "proposalSections": [
    {
      "title": "Section title",
      "content": "Full section content (200-500 words each)",
      "wordCount": 350
    }
  ],
  "pricingModel": {
    "totalBidPrice": ${bidPrice},
    "aiCosts": ${Math.round(estimatedValue * 0.08)},
    "humanCosts": ${Math.round(estimatedValue * 0.25)},
    "infrastructure": ${Math.round(estimatedValue * 0.05)},
    "overhead": ${Math.round(estimatedValue * 0.07)},
    "margin": ${Math.round(estimatedValue * 0.4)},
    "marginPercent": 47
  }
}

PROPOSAL SECTIONS TO INCLUDE:
1. Executive Summary
2. Understanding of Requirements
3. Technical Approach & Methodology
4. AI-Enhanced Delivery Model
5. Team & Qualifications
6. Quality Assurance Plan
7. Project Management & Timeline
8. Risk Management

COMPLIANCE MATRIX: Extract 6-10 key requirements from the description.
PRICING: Bid competitively at ${bidPercent}% of estimated value. Show realistic cost breakdown.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text);
    return { ...parsed, pricingRecommendation: recommendation };
  } catch {
    return {
      complianceMatrix: [
        {
          requirement: "General compliance with RFP requirements",
          section: "General",
          mandatory: true,
          response: "Bid response generation requires manual review for this tender.",
          status: "pending",
        },
      ],
      proposalSections: [
        {
          title: "Executive Summary",
          content: "Automated proposal generation encountered an issue. Please review the tender manually.",
          wordCount: 25,
        },
      ],
      pricingModel: {
        totalBidPrice: bidPrice,
        aiCosts: Math.round(estimatedValue * 0.08),
        humanCosts: Math.round(estimatedValue * 0.25),
        infrastructure: Math.round(estimatedValue * 0.05),
        overhead: Math.round(estimatedValue * 0.07),
        margin: Math.round(estimatedValue * 0.4),
        marginPercent: 47,
      },
      pricingRecommendation: recommendation,
    };
  }
}

// ─── Fulfillment Agent ───────────────────────────────────────────────────────
// Routes to the correct system prompt based on AI category.
// Returns a complete deliverable as markdown text.

export interface FulfillmentInput {
  category: AICategory;
  tenderTitle: string;
  department: string;
  contractValue: number;
  brief: string;         // Requirements from RFP
  inputContent?: string; // Source material (for translation, transcription, doc review)
}

export interface FulfillmentOutput {
  deliverable: string;
  format: "markdown" | "plain" | "structured";
  estimatedQuality: number;
  humanReviewNotes: string[];
  wordCount: number;
  estimatedAICost: number;
  passes?: PassResult[];
}

const FULFILLMENT_PROMPTS: Record<AICategory, (input: FulfillmentInput) => string> = {
  TRANSLATION: (i) => `You are a professional Canadian government translator (EN↔FR). Translate the following content faithfully and accurately, maintaining the original formatting, tone, and technical terminology. Use Canadian French/English conventions.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

BRIEF / INSTRUCTIONS:
${i.brief}

SOURCE CONTENT TO TRANSLATE:
${i.inputContent || "(No source content provided — draft a sample bilingual document based on the brief)"}

Produce the complete translated document. Use proper headings, preserve all section structure, and flag any terms requiring glossary notation with [NOTE: ...].`,

  WRITING: (i) => `You are a senior research analyst and technical writer for a Canadian government consulting firm. Write a complete, professional research report based on the requirements below.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

REQUIREMENTS:
${i.brief}

REFERENCE MATERIAL:
${i.inputContent || "(None provided)"}

Produce a complete report with:
- Executive Summary (250 words)
- Background and Context
- Methodology
- Findings (detailed, evidence-based)
- Analysis and Discussion
- Recommendations (numbered, actionable)
- Conclusion
- References (cite as [1], [2] etc. with placeholder URLs)

Write in formal Government of Canada report style. Minimum 1,500 words.`,

  DATA_ANALYSIS: (i) => `You are a senior data analyst and business intelligence specialist. Produce a complete data analysis report based on the brief and any data provided.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

ANALYSIS BRIEF:
${i.brief}

DATA / CONTEXT:
${i.inputContent || "(No raw data provided — construct analysis framework and sample findings)"}

Produce:
1. Analysis Methodology (how data was processed)
2. Key Findings (with simulated statistics where data not provided)
3. Data Tables (markdown format)
4. Trend Analysis
5. Visualizations Description (describe charts/graphs that should be created)
6. Recommendations with supporting rationale
7. Limitations and caveats

Use precise language, confidence intervals where relevant, and government-appropriate formatting.`,

  TRANSCRIPTION: (i) => `You are a professional transcriptionist and editor. Clean and format the following audio/video transcript content into a polished, publication-ready document.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

BRIEF:
${i.brief}

RAW TRANSCRIPT OR NOTES:
${i.inputContent || "(No transcript provided — produce a sample structured meeting minutes template based on the brief)"}

Produce:
- Clean, formatted transcript with speaker labels
- Timestamps where indicated
- [INAUDIBLE] markers for unclear sections
- Summary section at the end
- Action items extracted and listed separately
- Format: professional Government of Canada document style`,

  DOCUMENT_REVIEW: (i) => `You are a senior government document analyst. Review, summarize, and analyze the documents provided and produce a comprehensive review report.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

REVIEW BRIEF:
${i.brief}

DOCUMENTS TO REVIEW:
${i.inputContent || "(No documents provided — produce a review framework and sample analysis structure)"}

Produce:
- Executive Summary of documents reviewed
- Key Themes and Findings
- Document-by-Document Analysis (if multiple)
- Gaps or Inconsistencies Identified
- Compliance Assessment (where applicable)
- Recommendations
- Appendix: Detailed annotations`,

  COMMS: (i) => `You are a senior communications specialist for a Canadian government contractor. Produce all requested communications materials based on the brief.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

COMMUNICATIONS BRIEF:
${i.brief}

REFERENCE MATERIAL:
${i.inputContent || "(None)"}

Produce complete, publication-ready communications materials. This may include:
- Press releases (inverted pyramid structure, boilerplate included)
- Web content (optimized for gov.ca style guide)
- Social media posts (Twitter/X, LinkedIn — specify character counts)
- Newsletter articles
- FAQ documents
- Key messages and talking points

Write in plain language (Flesch-Kincaid grade 8 target), bilingual structure notes where needed.`,

  TRAINING: (i) => `You are a senior instructional designer and curriculum developer. Develop complete training materials based on the requirements below.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

TRAINING REQUIREMENTS:
${i.brief}

REFERENCE / SOURCE MATERIAL:
${i.inputContent || "(None provided)"}

Produce:
1. Learning Objectives (SMART, Bloom's taxonomy levels)
2. Course Outline (modules, topics, duration)
3. Facilitator Guide (detailed session notes)
4. Participant Workbook (activities, exercises, reflection prompts)
5. Assessment Tools (quiz questions with answer key)
6. Job Aids / Quick Reference Cards
7. Implementation Notes (delivery recommendations, room setup, materials list)

Follow adult learning principles (Knowles' andragogy). Flag sections requiring SME review.`,

  SURVEY: (i) => `You are a senior survey methodologist and research analyst. Design and document a complete survey instrument and analysis plan.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

SURVEY REQUIREMENTS:
${i.brief}

BACKGROUND:
${i.inputContent || "(None provided)"}

Produce:
1. Survey Methodology (rationale for approach, sampling strategy)
2. Complete Questionnaire (numbered questions, response scales, skip logic notes)
3. Pre-test Protocol
4. Recruitment and Administration Plan
5. Analysis Plan (how responses will be coded and analyzed)
6. Reporting Template
7. Ethics Considerations
8. Timeline and Milestones

Use validated scale formats (Likert, semantic differential) where appropriate.`,

  IT_CONSULTING: (i) => `You are a senior IT consultant and enterprise architect. Produce a professional IT advisory report based on the scope below.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

SCOPE OF WORK:
${i.brief}

CONTEXT / EXISTING DOCUMENTATION:
${i.inputContent || "(None provided)"}

Produce:
1. Current State Assessment
2. Gap Analysis
3. Technical Recommendations (with rationale)
4. Architecture Diagrams (described in text, Mermaid diagram syntax where useful)
5. Implementation Roadmap (phased approach)
6. Risk Register
7. Technology Stack Recommendations
8. Cost-Benefit Summary
9. Vendor-Neutral Considerations

Use GC EARB and TBS Digital Standards as guiding frameworks.`,

  POLICY: (i) => `You are a senior policy analyst for a Canadian government consulting firm. Research and draft a complete policy document based on the requirements.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

POLICY BRIEF:
${i.brief}

REFERENCE MATERIAL:
${i.inputContent || "(None provided)"}

Produce:
1. Issue Background and Context
2. Policy Problem Statement
3. Environmental Scan (domestic and international comparators)
4. Stakeholder Analysis
5. Policy Options (minimum 3, with pros/cons)
6. Recommended Option with Rationale
7. Implementation Considerations
8. Evaluation Framework
9. Consultation Summary (if applicable)

Follow TBS Policy Suite and Cabinet Directive on Regulation conventions.`,

  AUDIT: (i) => `You are a senior compliance auditor and assurance specialist. Develop a complete audit framework and conduct the audit based on the scope provided.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

AUDIT SCOPE:
${i.brief}

DOCUMENTATION TO REVIEW:
${i.inputContent || "(None provided — produce audit framework and sample findings structure)"}

Produce:
1. Audit Objective and Scope
2. Audit Criteria (specific standards or policies being audited against)
3. Methodology (sampling approach, interview protocols, document review process)
4. Detailed Findings (one finding per section: criteria, condition, cause, effect)
5. Risk Rating for Each Finding (High/Medium/Low)
6. Management Response Template
7. Recommendations (numbered, SMART)
8. Audit Opinion
9. Appendices (criteria matrix, sample tested)

Follow OAG or IIA standards as applicable.`,

  TESTING: (i) => `You are a senior QA engineer and test manager. Produce a comprehensive testing deliverable based on the requirements.

CONTRACT: ${i.tenderTitle} — ${i.department}
VALUE: $${i.contractValue.toLocaleString()} CAD

TESTING SCOPE:
${i.brief}

SYSTEM CONTEXT:
${i.inputContent || "(None provided — produce testing framework and sample test cases)"}

Produce:
1. Test Strategy
2. Test Plan (scope, approach, entry/exit criteria)
3. Test Cases (table format: ID, description, preconditions, steps, expected result)
4. Defect Report Template
5. Test Execution Summary Template
6. Accessibility Testing Checklist (WCAG 2.1 AA)
7. Performance Testing Scenarios
8. Regression Test Suite Outline
9. Go/No-Go Criteria

Reference GC EARB testing standards and ATAG/WCAG guidelines.`,
};

export async function runFulfillmentAgent(input: FulfillmentInput): Promise<FulfillmentOutput> {
  const rawPrompt = FULFILLMENT_PROMPTS[input.category]?.(input);

  if (!rawPrompt) {
    throw new Error(`No fulfillment agent defined for category: ${input.category}`);
  }

  const companyCfg = await getConfigSection("company");
  const companyPrefix = `You are working for ${companyCfg.companyName}. Company capabilities: ${companyCfg.capabilities.join(", ")}.\n\n`;
  const prompt = companyPrefix + rawPrompt;

  const fulfillmentCfg = await getConfigSection("fulfillment");

  // Pass 1: Initial draft
  const response = await anthropic.messages.create({
    model: fulfillmentCfg.claudeModel,
    max_tokens: fulfillmentCfg.maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  let deliverable = response.content[0].type === "text" ? response.content[0].text : "";
  const passes: PassResult[] = [];

  // Multi-pass quality pipeline
  if (fulfillmentCfg.multiPassEnabled) {
    const numberOfPasses = fulfillmentCfg.numberOfPasses;
    const multiPassPrompts = buildMultiPassPrompts({
      category: input.category,
      brief: input.brief,
      initialDraft: deliverable,
    });

    // Pass 2: Self-review
    if (numberOfPasses >= 2) {
      const pass2Response = await anthropic.messages.create({
        model: fulfillmentCfg.claudeModel,
        max_tokens: fulfillmentCfg.maxTokens,
        messages: [{ role: "user", content: multiPassPrompts.pass2_review }],
      });
      const pass2Text = pass2Response.content[0].type === "text" ? pass2Response.content[0].text : "";
      const pass2Result = parsePassResult(2, "Self-Review", pass2Text);
      passes.push(pass2Result);
      deliverable = pass2Result.output;
    }

    // Pass 3: Compliance check
    if (numberOfPasses >= 3) {
      const pass3Prompt = multiPassPrompts.pass3_compliance.replace("{{PASS2_OUTPUT}}", deliverable);
      const pass3Response = await anthropic.messages.create({
        model: fulfillmentCfg.claudeModel,
        max_tokens: fulfillmentCfg.maxTokens,
        messages: [{ role: "user", content: pass3Prompt }],
      });
      const pass3Text = pass3Response.content[0].type === "text" ? pass3Response.content[0].text : "";
      const pass3Result = parsePassResult(3, "Compliance Check", pass3Text);
      passes.push(pass3Result);
      deliverable = pass3Result.output;
    }

    // Pass 4: Final polish
    if (numberOfPasses >= 4) {
      const pass4Prompt = multiPassPrompts.pass4_polish.replace("{{PASS3_OUTPUT}}", deliverable);
      const pass4Response = await anthropic.messages.create({
        model: fulfillmentCfg.claudeModel,
        max_tokens: fulfillmentCfg.maxTokens,
        messages: [{ role: "user", content: pass4Prompt }],
      });
      const pass4Text = pass4Response.content[0].type === "text" ? pass4Response.content[0].text : "";
      const pass4Result = parsePassResult(4, "Final Polish", pass4Text);
      passes.push(pass4Result);
      deliverable = pass4Result.output;
    }
  }

  const wordCount = deliverable.split(/\s+/).filter(Boolean).length;

  // Estimate cost: ~$3 per million input tokens, ~$15 per million output tokens (Sonnet pricing)
  const outputTokens = response.usage?.output_tokens ?? wordCount * 1.3;
  const inputTokens = response.usage?.input_tokens ?? prompt.length / 4;
  const estimatedAICost = Math.round((inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15);

  const humanReviewNotes = generateReviewNotes(input.category, deliverable);

  return {
    deliverable,
    format: "markdown",
    estimatedQuality: estimateQuality(deliverable, input.category),
    humanReviewNotes,
    wordCount,
    estimatedAICost: Math.max(estimatedAICost, 1),
    passes: passes.length > 0 ? passes : undefined,
  };
}

function estimateQuality(output: string, category: AICategory): number {
  const wordCount = output.split(/\s+/).length;
  const hasHeadings = /^#{1,3}\s/m.test(output);
  const hasSections = output.split("\n\n").length > 5;
  const hasLists = /^[-*]\s/m.test(output) || /^\d+\.\s/m.test(output);

  let score = 60;
  if (wordCount > 500) score += 10;
  if (wordCount > 1000) score += 10;
  if (hasHeadings) score += 8;
  if (hasSections) score += 6;
  if (hasLists) score += 6;

  // Category-specific quality signals
  if (category === "TRANSLATION" && output.length > 200) score += 5;
  if (category === "DATA_ANALYSIS" && /\|.*\|/m.test(output)) score += 5; // has tables

  return Math.min(score, 97);
}

function generateReviewNotes(category: AICategory, output: string): string[] {
  const notes: string[] = ["Review all factual claims and statistics before submission."];

  const categoryNotes: Partial<Record<AICategory, string[]>> = {
    TRANSLATION: [
      "Verify technical terminology against departmental glossary.",
      "Confirm bilingual formatting meets Treasury Board standards.",
      "Have a francophone review the French version for idiomatic accuracy.",
    ],
    WRITING: [
      "Verify all referenced statistics and sources.",
      "Confirm recommendations align with departmental mandate.",
      "Review for plain language compliance (target Grade 8 reading level).",
    ],
    DATA_ANALYSIS: [
      "Validate all numbers and percentages against source data.",
      "Confirm chart descriptions match actual data visualizations.",
      "Review statistical methods for appropriateness.",
    ],
    POLICY: [
      "Verify policy options against current government priorities.",
      "Confirm legislative references are current.",
      "Stakeholder analysis may need departmental input.",
    ],
    AUDIT: [
      "Validate findings against specific audit criteria.",
      "Risk ratings require professional judgment review.",
      "Management responses must come from auditee.",
    ],
    IT_CONSULTING: [
      "Architecture recommendations should be reviewed by a certified architect.",
      "Validate cost estimates against current market rates.",
      "Security recommendations must be reviewed against GC security standards.",
    ],
  };

  return [...notes, ...(categoryNotes[category] || [
    "Verify all specific claims against source materials.",
    "Review for tone and style consistency with client brand.",
  ])];
}

// ─── Bid Strength Analyzer ──────────────────────────────────────────────────

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

export async function analyzeBidStrength(params: {
  tenderTitle: string;
  department: string;
  estimatedValue: number;
  bidDraft: { complianceMatrix?: any[]; proposalSections?: any[]; pricingModel?: any };
  awardIntel?: { recommendedPrice?: number; confidence?: string };
}): Promise<BidStrengthAnalysis> {
  const { tenderTitle, department, estimatedValue, bidDraft, awardIntel } = params;

  const bidFulfillmentCfg = await getConfigSection("fulfillment");
  const response = await anthropic.messages.create({
    model: bidFulfillmentCfg.claudeModel,
    max_tokens: bidFulfillmentCfg.maxTokens,
    messages: [
      {
        role: "user",
        content: `You are an expert evaluator of Canadian government RFP bid proposals. Analyze the following bid draft against standard government procurement evaluation criteria and produce a detailed strength assessment.

TENDER:
Title: ${tenderTitle}
Department: ${department}
Estimated Value: $${estimatedValue.toLocaleString()} CAD

BID DRAFT:
Compliance Matrix: ${JSON.stringify(bidDraft.complianceMatrix || [], null, 2)}
Proposal Sections: ${JSON.stringify(bidDraft.proposalSections || [], null, 2)}
Pricing Model: ${JSON.stringify(bidDraft.pricingModel || {}, null, 2)}

AWARD INTELLIGENCE:
Recommended Price: ${awardIntel?.recommendedPrice ? `$${awardIntel.recommendedPrice.toLocaleString()}` : "N/A"}
Confidence: ${awardIntel?.confidence || "N/A"}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "overallScore": 78,
  "breakdown": {
    "compliance": 85,
    "pricing": 72,
    "technicalDepth": 80,
    "differentiators": 65,
    "riskFactors": 78
  },
  "weaknesses": [
    {
      "area": "Pricing",
      "issue": "Bid price is above the recommended competitive range",
      "severity": "warning",
      "recommendation": "Consider reducing bid price by 5-8% to align with historical award data"
    }
  ],
  "strengths": [
    "Strong compliance matrix coverage",
    "Clear AI-powered delivery methodology"
  ],
  "improvementPlan": [
    "Add case studies from similar government contracts",
    "Strengthen risk mitigation section"
  ]
}

EVALUATION CRITERIA:
- compliance (0-100): How well the bid addresses all mandatory and rated requirements
- pricing (0-100): Competitiveness and realism of pricing relative to estimate and intel
- technicalDepth (0-100): Depth of technical approach, methodology, and delivery plan
- differentiators (0-100): Unique value propositions, innovation, AI advantage
- riskFactors (0-100): How well risks are identified and mitigated (higher = less risky)

RULES:
- Be specific and actionable in weaknesses and recommendations
- severity must be "critical", "warning", or "info"
- overallScore should be a weighted average (compliance 30%, pricing 25%, technicalDepth 20%, differentiators 15%, riskFactors 10%)
- Include at least 2 weaknesses and 2 strengths
- Include at least 3 improvement plan items`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text);
    return {
      overallScore: Math.min(Math.max(parsed.overallScore || 0, 0), 100),
      breakdown: {
        compliance: Math.min(Math.max(parsed.breakdown?.compliance || 0, 0), 100),
        pricing: Math.min(Math.max(parsed.breakdown?.pricing || 0, 0), 100),
        technicalDepth: Math.min(Math.max(parsed.breakdown?.technicalDepth || 0, 0), 100),
        differentiators: Math.min(Math.max(parsed.breakdown?.differentiators || 0, 0), 100),
        riskFactors: Math.min(Math.max(parsed.breakdown?.riskFactors || 0, 0), 100),
      },
      weaknesses: parsed.weaknesses || [],
      strengths: parsed.strengths || [],
      improvementPlan: parsed.improvementPlan || [],
    };
  } catch {
    return {
      overallScore: 0,
      breakdown: { compliance: 0, pricing: 0, technicalDepth: 0, differentiators: 0, riskFactors: 0 },
      weaknesses: [{ area: "Analysis", issue: "Bid strength analysis failed — manual review required", severity: "critical", recommendation: "Retry the analysis or review the bid manually" }],
      strengths: [],
      improvementPlan: ["Retry bid strength analysis"],
    };
  }
}

// ─── Submission Package Generator ────────────────────────────────────────────

export async function generateSubmissionPackage(tender: Tender): Promise<SubmissionPackage> {
  const recommendation = recommendPrice({
    department: tender.department,
    category: "",
    estimatedValue: tender.estimatedValue,
  });
  const bidPercent = recommendation.bidAsPercentOfEstimate;
  const companyCfg = await getConfigSection("company");
  const fulfillmentCfg = await getConfigSection("fulfillment");

  const response = await anthropic.messages.create({
    model: fulfillmentCfg.claudeModel,
    max_tokens: fulfillmentCfg.maxTokens,
    messages: [
      {
        role: "user",
        content: `You are a senior Canadian government proposal writer. Generate a complete, submission-ready bid package for the tender below.

TENDER:
Title: ${tender.title}
External ID: ${tender.externalId}
Department: ${tender.department}
Estimated Value: $${tender.estimatedValue.toLocaleString()} CAD
Description: ${tender.description}
Closing Date: ${tender.closingDate}
AI Categories: ${tender.aiCategories.join(", ")}

Our company fulfills this contract using AI with minimal human oversight — our differentiator is fast delivery, lower cost, and consistent quality through AI-powered workflows.

Produce a complete bid package as JSON (no markdown wrapping, no code fences):
{
  "coverLetter": "Full professional cover letter (400 words). Address: Contracting Officer, ${tender.department}. Emphasize AI delivery capability, cost savings to taxpayer, and rapid turnaround.",
  "technicalVolume": "Full technical approach section (800 words). Describe AI workflow in concrete terms: which tools, how data flows, quality gates, delivery format.",
  "pricingSchedule": "Structured pricing breakdown table in markdown. Bid at ${bidPercent}% of estimated value. Show: AI platform costs, human review time, project management, overhead, margin.",
  "complianceMatrix": "Markdown table: | Requirement | RFP Ref | Our Response | Status |. Extract 8 requirements from the description.",
  "aboutUs": "${companyCfg.aboutUs}"
}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text);
    return {
      tenderId: tender.id,
      tenderTitle: tender.title,
      department: tender.department,
      coverLetter: parsed.coverLetter || "",
      technicalVolume: parsed.technicalVolume || "",
      pricingSchedule: parsed.pricingSchedule || "",
      complianceMatrix: parsed.complianceMatrix || "",
      aboutUs: parsed.aboutUs || "",
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      tenderId: tender.id,
      tenderTitle: tender.title,
      department: tender.department,
      coverLetter: "Generation failed — please retry.",
      technicalVolume: "",
      pricingSchedule: "",
      complianceMatrix: "",
      aboutUs: "",
      generatedAt: new Date().toISOString(),
    };
  }
}
