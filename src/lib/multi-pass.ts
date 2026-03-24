// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PassResult {
  passNumber: number;
  passName: string;
  output: string;
  changes: string[];
  qualityScore: number;
  timestamp: string;
}

export interface MultiPassResult {
  passes: PassResult[];
  finalOutput: string;
  finalQualityScore: number;
  totalPasses: number;
  improvementNotes: string[];
}

export interface MultiPassPrompts {
  pass2_review: string;
  pass3_compliance: string;
  pass4_polish: string;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build the prompts for passes 2-4 of the quality pipeline.
 * Pass 1 is the initial draft produced by the existing fulfillment agent.
 */
export function buildMultiPassPrompts(params: {
  category: string;
  brief: string;
  initialDraft: string;
}): MultiPassPrompts {
  const { category, brief, initialDraft } = params;

  // -- Pass 2: Self-Review --------------------------------------------------
  const pass2_review = `You are a senior proposal analyst reviewing an AI-generated bid draft.

CATEGORY: ${category}

ORIGINAL RFP REQUIREMENTS:
${brief}

DRAFT TO REVIEW:
${initialDraft}

INSTRUCTIONS:
1. List every requirement from the RFP above.
2. For each requirement, evaluate:
   - Is it addressed in the draft? (YES / PARTIAL / NO)
   - If YES or PARTIAL, how well is it addressed? (1-5 scale)
   - What specific additions or corrections are needed?
3. Identify any gaps where requirements are missing entirely.
4. Produce an IMPROVED version of the draft that fills all gaps and strengthens weak areas.

OUTPUT FORMAT:
- Start with the improved draft (the full document, not just changes).
- After the draft, list each change on its own line prefixed with "CHANGE:" describing what was added or modified.
- If anything needs human review, add a line prefixed with "FLAG:" explaining why.`;

  // -- Pass 3: Compliance Check ---------------------------------------------
  const pass3_compliance = `You are a government proposal compliance specialist.

CATEGORY: ${category}

ORIGINAL RFP REQUIREMENTS:
${brief}

DRAFT TO CHECK (output of previous review pass):
{{PASS2_OUTPUT}}

INSTRUCTIONS:
1. Verify every section from the original brief is present and properly labelled.
2. Check formatting:
   - Consistent heading hierarchy (H1, H2, H3)
   - No orphan bullet points (every list has at least two items)
   - Proper paragraph structure (no single-sentence paragraphs unless intentional)
3. Check for common government document issues:
   - Excessive passive voice (flag sentences that should be active)
   - Jargon or acronyms used without definition on first use
   - Missing cross-references between sections
4. Verify word counts are reasonable for each section.
5. Fix all issues found and produce the further-improved draft.

OUTPUT FORMAT:
- Start with the compliance-fixed draft (full document).
- After the draft, list each change on its own line prefixed with "CHANGE:".
- Flag items needing human review with "FLAG:".
- Add any informational notes with "NOTE:".`;

  // -- Pass 4: Final Polish -------------------------------------------------
  const pass4_polish = `You are a plain-language editor specializing in Government of Canada procurement documents.

CATEGORY: ${category}

ORIGINAL RFP REQUIREMENTS:
${brief}

DRAFT TO POLISH (output of compliance pass):
{{PASS3_OUTPUT}}

INSTRUCTIONS:
1. Apply Government of Canada plain language standards:
   - Target Grade 8 reading level (Flesch-Kincaid)
   - Short sentences (aim for 15-20 words average)
   - Active voice wherever possible
   - Common words over technical jargon
2. Ensure consistent terminology throughout the document (same term for the same concept every time).
3. Fix any remaining grammatical or stylistic issues.
4. Add transitional phrases between sections for smooth reading flow.
5. Verify the executive summary accurately reflects the full document content.
6. Ensure the document is ready for delivery with no placeholder text remaining.

OUTPUT FORMAT:
- Start with the final polished document.
- After the document, list each change on its own line prefixed with "CHANGE:".
- Add any final notes with "NOTE:".`;

  return {
    pass2_review,
    pass3_compliance,
    pass4_polish,
  };
}

// ---------------------------------------------------------------------------
// Pass result parser
// ---------------------------------------------------------------------------

const CHANGE_PREFIX = /^CHANGE:\s*/i;
const NOTE_PREFIX = /^NOTE:\s*/i;
const FLAG_PREFIX = /^FLAG:\s*/i;

/**
 * Parse an AI response into a structured PassResult.
 *
 * Extracts the main document content (everything before the first
 * CHANGE:/NOTE:/FLAG: line) and collects metadata lines separately.
 */
export function parsePassResult(
  passNumber: number,
  passName: string,
  aiResponse: string
): PassResult {
  const lines = aiResponse.split("\n");

  const contentLines: string[] = [];
  const changes: string[] = [];
  let inMetadata = false;

  for (const line of lines) {
    if (
      CHANGE_PREFIX.test(line) ||
      NOTE_PREFIX.test(line) ||
      FLAG_PREFIX.test(line)
    ) {
      inMetadata = true;
      const cleaned = line
        .replace(CHANGE_PREFIX, "")
        .replace(NOTE_PREFIX, "")
        .replace(FLAG_PREFIX, "")
        .trim();
      if (cleaned) changes.push(cleaned);
    } else if (inMetadata && line.trim() === "") {
      // blank lines between metadata entries are fine
    } else if (inMetadata) {
      // Non-prefixed line after metadata started — could be continuation
      // Append to last change if exists
      if (changes.length > 0) {
        changes[changes.length - 1] += " " + line.trim();
      }
    } else {
      contentLines.push(line);
    }
  }

  const output = contentLines.join("\n").trim();
  const qualityScore = estimateQualityScore(output);

  return {
    passNumber,
    passName,
    output,
    changes,
    qualityScore,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Quality estimation heuristic
// ---------------------------------------------------------------------------

function estimateQualityScore(text: string): number {
  let score = 0;

  // Word count contribution (0-25 pts)
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 500) score += 25;
  else if (wordCount >= 200) score += 20;
  else if (wordCount >= 100) score += 15;
  else if (wordCount >= 50) score += 10;
  else score += 5;

  // Section/heading count (0-25 pts)
  const headingMatches = text.match(/^#{1,3}\s+.+$/gm) ?? [];
  const sectionCount = headingMatches.length;
  if (sectionCount >= 6) score += 25;
  else if (sectionCount >= 4) score += 20;
  else if (sectionCount >= 2) score += 15;
  else if (sectionCount >= 1) score += 10;
  else score += 0;

  // Has bullet/numbered lists (0-15 pts)
  const hasList = /^[\s]*[-*]\s+.+$/m.test(text) || /^\s*\d+\.\s+.+$/m.test(text);
  score += hasList ? 15 : 0;

  // Has tables (0-10 pts)
  const hasTable = /\|.+\|/.test(text);
  score += hasTable ? 10 : 0;

  // Structural consistency — paragraphs of reasonable length (0-15 pts)
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paragraphs.length >= 5) score += 15;
  else if (paragraphs.length >= 3) score += 10;
  else score += 5;

  // No placeholder text bonus (0-10 pts)
  const hasPlaceholders = /\[.*?\]|TODO|TBD|PLACEHOLDER/i.test(text);
  score += hasPlaceholders ? 0 : 10;

  return Math.min(score, 100);
}
