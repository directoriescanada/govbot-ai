// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Core Type Definitions
// ═══════════════════════════════════════════════════════════════════

export type AICategory =
  | "TRANSLATION"
  | "WRITING"
  | "DATA_ANALYSIS"
  | "TRANSCRIPTION"
  | "DOCUMENT_REVIEW"
  | "COMMS"
  | "TRAINING"
  | "SURVEY"
  | "IT_CONSULTING"
  | "POLICY"
  | "AUDIT"
  | "TESTING";

export type BidComplexity = "Low" | "Medium" | "High";

export type OpportunitySource =
  | "canadabuys"
  | "merx"
  | "bcbid"
  | "ontario"
  | "seao"
  | "sam_gov"
  | "ungm"
  | "manual";

export type TenderStatus =
  | "open"
  | "closing_soon"
  | "closed"
  | "awarded"
  | "cancelled";

export interface AIFulfillmentPlan {
  approach: string;
  tools: string[];
  humanOversight: string;
  costReduction: string;
  deliverySpeed: string;
  risks: string[];
  estimatedAICost: number;
  estimatedHumanCost: number;
}

export interface Tender {
  id: string;
  externalId: string;
  title: string;
  description: string;
  department: string;
  category: string;
  gsin: string;
  closingDate: string;
  publicationDate: string;
  estimatedValue: number;
  solicitationType: string;
  region: string;
  tradeAgreements: string[];
  aiCategories: AICategory[];
  aiScore: number;
  competitorCount: number;
  bidComplexity: BidComplexity;
  aiFulfillment: AIFulfillmentPlan | null;
  source: OpportunitySource;
  sourceUrl: string;
  status: TenderStatus;
  computedScore?: number;
  blockers?: TenderBlocker[];
  createdAt: string;
  updatedAt: string;
}

export interface AwardNotice {
  id: string;
  tenderId: string;
  title: string;
  department: string;
  awardDate: string;
  vendorName: string;
  contractValue: number;
  category: string;
  gsin: string;
  source: OpportunitySource;
  createdAt: string;
}

export interface BidResponse {
  id: string;
  tenderId: string;
  complianceMatrix: ComplianceItem[];
  proposalSections: ProposalSection[];
  pricingModel: PricingModel;
  status: "draft" | "review" | "submitted";
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceItem {
  requirement: string;
  section: string;
  mandatory: boolean;
  response: string;
  status: "met" | "partial" | "not_met" | "pending";
}

export interface ProposalSection {
  title: string;
  content: string;
  wordCount: number;
}

export interface PricingModel {
  totalBidPrice: number;
  aiCosts: number;
  humanCosts: number;
  infrastructure: number;
  overhead: number;
  margin: number;
  marginPercent: number;
}

export interface UserProfile {
  id: string;
  email: string;
  companyName: string;
  plan: "free" | "scout" | "pro" | "enterprise";
  stripeCustomerId: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totalOpportunities: number;
  pipelineValue: number;
  avgScore: number;
  highValueCount: number;
  newToday: number;
  closingSoon: number;
}

// ─── Blocker Detection ───────────────────────────────────────────────────────

export interface TenderBlocker {
  type: "clearance" | "license" | "incumbency" | "foreign" | "physical_presence" | "insurance" | "excluded_keyword";
  label: string;
  severity: "hard" | "soft"; // hard = disqualifying, soft = manageable
}

// ─── Fulfillment Engine ──────────────────────────────────────────────────────

export type FulfillmentStatus = "pending" | "running" | "review" | "delivered" | "invoiced";

export interface FulfillmentJob {
  id: string;
  tenderId: string;
  tenderTitle: string;
  department: string;
  category: AICategory;
  status: FulfillmentStatus;
  brief: string;           // RFP requirements / project brief
  inputContent: string;    // source docs (for translation, transcription, doc review)
  output: string;          // final deliverable content
  reviewNotes: string;
  estimatedAICost: number;
  agentLog: string[];
  createdAt: string;
  completedAt?: string;
}

// ─── Submission Package ──────────────────────────────────────────────────────

export interface SubmissionPackage {
  tenderId: string;
  tenderTitle: string;
  department: string;
  coverLetter: string;
  technicalVolume: string;
  pricingSchedule: string;
  complianceMatrix: string;
  aboutUs: string;
  generatedAt: string;
}

// ─── Operations / Contract Management ───────────────────────────────────────

export type ContractStatus =
  | "active"
  | "in_fulfillment"
  | "delivered"
  | "invoiced"
  | "paid"
  | "closed";

export interface ContractOp {
  id: string;
  tenderId: string;
  externalId: string;
  title: string;
  department: string;
  category: AICategory;
  contractValue: number;
  bidPrice: number;
  wonDate: string;
  startDate: string;
  deliverableDue: string;
  deliverableDescription: string;
  status: ContractStatus;
  fulfillmentJobId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  paidDate?: string;
  marginPercent: number;
  aiCostActual: number;
  notes: string;
  createdAt: string;
}

export interface OpsSummary {
  activeContracts: number;
  totalContractValue: number;
  totalInvoiced: number;
  totalPaid: number;
  avgMarginPercent: number;
  upcomingDeadlines: ContractOp[];
}
