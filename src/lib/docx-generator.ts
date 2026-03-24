import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  BorderStyle,
  ShadingType,
  TableOfContents,
} from "docx";
import { getConfigSection } from "@/lib/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BidDocxInput {
  tenderTitle: string;
  tenderRef: string;
  department: string;
  closingDate: string;
  complianceMatrix: Array<{
    requirement: string;
    section: string;
    mandatory: boolean;
    response: string;
    status: string;
  }>;
  proposalSections: Array<{
    title: string;
    content: string;
  }>;
  pricingModel: {
    totalBidPrice: number;
    aiCosts: number;
    humanCosts: number;
    infrastructure: number;
    overhead: number;
    margin: number;
    marginPercent: number;
  };
  aboutUs?: string;
}

export interface DeliverableDocxInput {
  title: string;
  department: string;
  contractRef: string;
  content: string;
  isDraft: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const docsCfg = getConfigSection("documents");
const FONT = docsCfg.font;
const BODY_SIZE = docsCfg.bodySize * 2; // half-points
const HEADING_SIZE = docsCfg.headingSize * 2; // half-points

const COLORS = {
  met: "22C55E",
  partial: "F59E0B",
  not_met: "EF4444",
  headerBg: "1E3A5F",
  headerText: "FFFFFF",
  altRow: "F3F4F6",
  white: "FFFFFF",
} as const;

function formatCurrency(value: number): string {
  return (
    "$" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function statusColor(status: string): string {
  const s = status.toLowerCase().replace(/\s+/g, "_");
  if (s === "met") return COLORS.met;
  if (s === "partial") return COLORS.partial;
  return COLORS.not_met;
}

function textRun(
  text: string,
  opts?: { bold?: boolean; size?: number; color?: string; font?: string },
): TextRun {
  return new TextRun({
    text,
    bold: opts?.bold,
    size: opts?.size ?? BODY_SIZE,
    color: opts?.color,
    font: opts?.font ?? FONT,
  });
}

function headerParagraph(): Paragraph {
  return new Paragraph({
    children: [
      textRun(getConfigSection("documents").headerText || getConfigSection("company").companyName, {
        bold: true,
        size: 18,
        color: "666666",
      }),
    ],
    alignment: AlignmentType.RIGHT,
  });
}

function footerParagraph(): Paragraph {
  const footerText = getConfigSection("documents").footerText;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      textRun(footerText ? `${footerText} — Page ` : "Page ", { size: 18, color: "999999" }),
      new TextRun({
        children: [PageNumber.CURRENT],
        size: 18,
        color: "999999",
        font: FONT,
      }),
      textRun(" of ", { size: 18, color: "999999" }),
      new TextRun({
        children: [PageNumber.TOTAL_PAGES],
        size: 18,
        color: "999999",
        font: FONT,
      }),
    ],
  });
}

function defaultHeader(): Header {
  return new Header({ children: [headerParagraph()] });
}

function defaultFooter(): Footer {
  return new Footer({ children: [footerParagraph()] });
}

/** Create a table cell with shading */
function shadedCell(
  text: string,
  opts?: {
    bold?: boolean;
    color?: string;
    shading?: string;
    width?: number;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  },
): TableCell {
  return new TableCell({
    width: opts?.width
      ? { size: opts.width, type: WidthType.PERCENTAGE }
      : undefined,
    shading: opts?.shading
      ? { type: ShadingType.SOLID, color: opts.shading, fill: opts.shading }
      : undefined,
    children: [
      new Paragraph({
        alignment: opts?.alignment,
        spacing: { before: 40, after: 40 },
        children: [
          textRun(text, {
            bold: opts?.bold,
            color: opts?.color,
            size: BODY_SIZE,
          }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Markdown parsing helpers
// ---------------------------------------------------------------------------

interface ParsedLine {
  type: "heading1" | "heading2" | "heading3" | "bullet" | "numbered" | "paragraph" | "table_row";
  text: string;
  level?: number;
}

function classifyLine(line: string): ParsedLine {
  const trimmed = line.trimEnd();
  if (trimmed.startsWith("### "))
    return { type: "heading3", text: trimmed.slice(4) };
  if (trimmed.startsWith("## "))
    return { type: "heading2", text: trimmed.slice(3) };
  if (trimmed.startsWith("# "))
    return { type: "heading1", text: trimmed.slice(2) };
  if (/^\s*[-*]\s+/.test(trimmed))
    return { type: "bullet", text: trimmed.replace(/^\s*[-*]\s+/, "") };
  if (/^\s*\d+\.\s+/.test(trimmed))
    return { type: "numbered", text: trimmed.replace(/^\s*\d+\.\s+/, "") };
  if (trimmed.startsWith("|") && trimmed.endsWith("|"))
    return { type: "table_row", text: trimmed };
  return { type: "paragraph", text: trimmed };
}

/** Parse inline markdown (bold **text**) into TextRun[] */
function parseInlineMarkdown(text: string, baseBold = false): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(
        textRun(text.slice(lastIndex, match.index), { bold: baseBold }),
      );
    }
    runs.push(textRun(match[1], { bold: true }));
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push(textRun(text.slice(lastIndex), { bold: baseBold }));
  }
  if (runs.length === 0) {
    runs.push(textRun(text, { bold: baseBold }));
  }
  return runs;
}

/** Convert markdown content string into docx Paragraph/Table children */
function markdownToDocxChildren(
  markdown: string,
): (Paragraph | Table)[] {
  const lines = markdown.split("\n");
  const children: (Paragraph | Table)[] = [];
  let tableRows: string[][] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableRows.length === 0) return;
    // Filter out separator rows (---|---|---)
    const dataRows = tableRows.filter(
      (row) => !row.every((cell) => /^[-:]+$/.test(cell.trim())),
    );
    if (dataRows.length === 0) {
      tableRows = [];
      inTable = false;
      return;
    }

    const colCount = dataRows[0].length;
    const rows = dataRows.map(
      (cells, rowIdx) =>
        new TableRow({
          children: cells.map((cell) =>
            shadedCell(cell.trim(), {
              bold: rowIdx === 0,
              shading: rowIdx === 0 ? COLORS.headerBg : undefined,
              color: rowIdx === 0 ? COLORS.headerText : undefined,
            }),
          ),
        }),
    );

    children.push(
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    tableRows = [];
    inTable = false;
  };

  for (const line of lines) {
    const parsed = classifyLine(line);

    if (parsed.type === "table_row") {
      inTable = true;
      const cells = parsed.text
        .split("|")
        .filter((_, i, arr) => i > 0 && i < arr.length - 1);
      tableRows.push(cells);
      continue;
    }

    if (inTable) {
      flushTable();
    }

    switch (parsed.type) {
      case "heading1":
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
            children: [
              textRun(parsed.text, { bold: true, size: HEADING_SIZE }),
            ],
          }),
        );
        break;
      case "heading2":
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
            children: [textRun(parsed.text, { bold: true, size: 24 })],
          }),
        );
        break;
      case "heading3":
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 },
            children: [textRun(parsed.text, { bold: true, size: BODY_SIZE })],
          }),
        );
        break;
      case "bullet":
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 40, after: 40 },
            children: parseInlineMarkdown(parsed.text),
          }),
        );
        break;
      case "numbered":
        children.push(
          new Paragraph({
            numbering: { reference: "default-numbering", level: 0 },
            spacing: { before: 40, after: 40 },
            children: parseInlineMarkdown(parsed.text),
          }),
        );
        break;
      case "paragraph":
        if (parsed.text.trim().length === 0) {
          children.push(
            new Paragraph({ spacing: { after: 120 }, children: [] }),
          );
        } else {
          children.push(
            new Paragraph({
              spacing: { before: 60, after: 60, line: 276 },
              children: parseInlineMarkdown(parsed.text),
            }),
          );
        }
        break;
    }
  }

  if (inTable) {
    flushTable();
  }

  return children;
}

// ---------------------------------------------------------------------------
// Cover page builders
// ---------------------------------------------------------------------------

function buildBidCoverPage(data: BidDocxInput): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        textRun("CONFIDENTIAL", {
          bold: true,
          size: 32,
          color: "CC0000",
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        textRun(getConfigSection("company").companyName, { bold: true, size: 48 }),
      ],
    }),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        textRun("Proposal Submission", { bold: true, size: 36 }),
      ],
    }),
    new Paragraph({ spacing: { after: 400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [textRun(data.tenderTitle, { bold: true, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        textRun(`Reference: ${data.tenderRef}`, { size: 24, color: "555555" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        textRun(`Department: ${data.department}`, {
          size: 24,
          color: "555555",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        textRun(`Closing Date: ${data.closingDate}`, {
          size: 24,
          color: "555555",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        textRun(`Submitted: ${new Date().toLocaleDateString("en-CA")}`, {
          size: 24,
          color: "555555",
        }),
      ],
    }),
  ];
}

function buildDeliverableCoverPage(data: DeliverableDocxInput): Paragraph[] {
  const label = data.isDraft ? "DRAFT" : "FINAL";
  const labelColor = data.isDraft ? "F59E0B" : "22C55E";

  return [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [textRun(label, { bold: true, size: 36, color: labelColor })],
    }),
    new Paragraph({ spacing: { after: 400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [textRun(data.title, { bold: true, size: 44 })],
    }),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        textRun(`Contract: ${data.contractRef}`, {
          size: 24,
          color: "555555",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        textRun(`Department: ${data.department}`, {
          size: 24,
          color: "555555",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        textRun(`Date: ${new Date().toLocaleDateString("en-CA")}`, {
          size: 24,
          color: "555555",
        }),
      ],
    }),
  ];
}

// ---------------------------------------------------------------------------
// Table builders
// ---------------------------------------------------------------------------

function buildComplianceTable(
  matrix: BidDocxInput["complianceMatrix"],
): (Paragraph | Table)[] {
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [textRun("Compliance Matrix", { bold: true, size: HEADING_SIZE })],
  });

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      shadedCell("#", {
        bold: true,
        color: COLORS.headerText,
        shading: COLORS.headerBg,
        width: 5,
      }),
      shadedCell("Requirement", {
        bold: true,
        color: COLORS.headerText,
        shading: COLORS.headerBg,
        width: 30,
      }),
      shadedCell("RFP Section", {
        bold: true,
        color: COLORS.headerText,
        shading: COLORS.headerBg,
        width: 12,
      }),
      shadedCell("Mandatory", {
        bold: true,
        color: COLORS.headerText,
        shading: COLORS.headerBg,
        width: 10,
      }),
      shadedCell("Our Response", {
        bold: true,
        color: COLORS.headerText,
        shading: COLORS.headerBg,
        width: 30,
      }),
      shadedCell("Status", {
        bold: true,
        color: COLORS.headerText,
        shading: COLORS.headerBg,
        width: 13,
      }),
    ],
  });

  const dataRows = (matrix ?? []).map(
    (row, idx) =>
      new TableRow({
        children: [
          shadedCell(String(idx + 1), {
            shading: idx % 2 === 1 ? COLORS.altRow : COLORS.white,
            alignment: AlignmentType.CENTER,
            width: 5,
          }),
          shadedCell(row.requirement ?? "", {
            shading: idx % 2 === 1 ? COLORS.altRow : COLORS.white,
            width: 30,
          }),
          shadedCell(row.section ?? "", {
            shading: idx % 2 === 1 ? COLORS.altRow : COLORS.white,
            width: 12,
          }),
          shadedCell(row.mandatory ? "Yes" : "No", {
            shading: idx % 2 === 1 ? COLORS.altRow : COLORS.white,
            alignment: AlignmentType.CENTER,
            width: 10,
          }),
          shadedCell(row.response ?? "", {
            shading: idx % 2 === 1 ? COLORS.altRow : COLORS.white,
            width: 30,
          }),
          new TableCell({
            width: { size: 13, type: WidthType.PERCENTAGE },
            shading: {
              type: ShadingType.SOLID,
              color: statusColor(row.status ?? "not_met"),
              fill: statusColor(row.status ?? "not_met"),
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [
                  textRun((row.status ?? "").toUpperCase(), {
                    bold: true,
                    color: COLORS.white,
                    size: BODY_SIZE,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
  );

  return [
    heading,
    new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
  ];
}

function buildPricingTable(
  pricing: BidDocxInput["pricingModel"],
): (Paragraph | Table)[] {
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [
      textRun("Pricing Summary", { bold: true, size: HEADING_SIZE }),
    ],
  });

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      shadedCell("Cost Item", {
        bold: true,
        color: COLORS.headerText,
        shading: COLORS.headerBg,
        width: 60,
      }),
      shadedCell("Amount ($)", {
        bold: true,
        color: COLORS.headerText,
        shading: COLORS.headerBg,
        width: 40,
        alignment: AlignmentType.RIGHT,
      }),
    ],
  });

  const items: Array<{ label: string; value: number }> = [
    { label: "AI & Automation Costs", value: pricing?.aiCosts ?? 0 },
    { label: "Human Resource Costs", value: pricing?.humanCosts ?? 0 },
    { label: "Infrastructure", value: pricing?.infrastructure ?? 0 },
    { label: "Overhead", value: pricing?.overhead ?? 0 },
    {
      label: `Margin (${pricing?.marginPercent ?? 0}%)`,
      value: pricing?.margin ?? 0,
    },
  ];

  const dataRows = items.map(
    (item, idx) =>
      new TableRow({
        children: [
          shadedCell(item.label, {
            shading: idx % 2 === 1 ? COLORS.altRow : COLORS.white,
            width: 60,
          }),
          shadedCell(formatCurrency(item.value), {
            shading: idx % 2 === 1 ? COLORS.altRow : COLORS.white,
            width: 40,
            alignment: AlignmentType.RIGHT,
          }),
        ],
      }),
  );

  const totalRow = new TableRow({
    children: [
      shadedCell("TOTAL BID PRICE", {
        bold: true,
        shading: COLORS.headerBg,
        color: COLORS.headerText,
        width: 60,
      }),
      shadedCell(formatCurrency(pricing?.totalBidPrice ?? 0), {
        bold: true,
        shading: COLORS.headerBg,
        color: COLORS.headerText,
        width: 40,
        alignment: AlignmentType.RIGHT,
      }),
    ],
  });

  return [
    heading,
    new Table({
      rows: [headerRow, ...dataRows, totalRow],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
  ];
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

export async function generateBidDocx(data: BidDocxInput): Promise<Buffer> {
  const children: (Paragraph | Table | TableOfContents)[] = [];

  // Cover page
  children.push(...buildBidCoverPage(data));

  // Page break before TOC
  children.push(
    new Paragraph({
      children: [],
      pageBreakBefore: true,
    }),
  );

  // Table of Contents
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      children: [
        textRun("Table of Contents", { bold: true, size: HEADING_SIZE }),
      ],
    }),
  );
  children.push(
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
  );

  // Page break before compliance matrix
  children.push(
    new Paragraph({
      children: [],
      pageBreakBefore: true,
    }),
  );

  // Compliance Matrix
  if (data.complianceMatrix && data.complianceMatrix.length > 0) {
    children.push(...buildComplianceTable(data.complianceMatrix));
  }

  // Proposal Sections
  for (const section of data.proposalSections ?? []) {
    children.push(
      new Paragraph({
        children: [],
        pageBreakBefore: true,
      }),
    );
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 200 },
        children: [
          textRun(section.title ?? "", { bold: true, size: HEADING_SIZE }),
        ],
      }),
    );
    if (section.content) {
      children.push(...markdownToDocxChildren(section.content));
    }
  }

  // Pricing Table
  if (data.pricingModel) {
    children.push(
      new Paragraph({
        children: [],
        pageBreakBefore: true,
      }),
    );
    children.push(...buildPricingTable(data.pricingModel));
  }

  // About Us
  children.push(
    new Paragraph({
      children: [],
      pageBreakBefore: true,
    }),
  );
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 200 },
      children: [textRun("About Us", { bold: true, size: HEADING_SIZE })],
    }),
  );
  children.push(
    new Paragraph({
      spacing: { after: 120, line: 276 },
      children: [
        textRun(
          data.aboutUs || getConfigSection("company").aboutUs,
        ),
      ],
    }),
  );

  const doc = new Document({
    features: {
      updateFields: true,
    },
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: NumberFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: BODY_SIZE,
          },
        },
        heading1: {
          run: {
            font: FONT,
            size: HEADING_SIZE,
            bold: true,
            color: "1E3A5F",
          },
        },
        heading2: {
          run: {
            font: FONT,
            size: 24,
            bold: true,
            color: "2D5282",
          },
        },
        heading3: {
          run: {
            font: FONT,
            size: BODY_SIZE,
            bold: true,
            color: "3B6BA5",
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: { default: defaultHeader() },
        footers: { default: defaultFooter() },
        children: children as (Paragraph | Table)[],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

export async function generateDeliverableDocx(
  data: DeliverableDocxInput,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Cover page
  children.push(...buildDeliverableCoverPage(data));

  // Page break before content
  children.push(
    new Paragraph({
      children: [],
      pageBreakBefore: true,
    }),
  );

  // Content from markdown
  if (data.content) {
    children.push(...markdownToDocxChildren(data.content));
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: NumberFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: BODY_SIZE,
          },
        },
        heading1: {
          run: {
            font: FONT,
            size: HEADING_SIZE,
            bold: true,
            color: "1E3A5F",
          },
        },
        heading2: {
          run: {
            font: FONT,
            size: 24,
            bold: true,
            color: "2D5282",
          },
        },
        heading3: {
          run: {
            font: FONT,
            size: BODY_SIZE,
            bold: true,
            color: "3B6BA5",
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: { default: defaultHeader() },
        footers: { default: defaultFooter() },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
