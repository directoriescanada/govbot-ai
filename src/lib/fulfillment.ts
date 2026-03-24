// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Fulfillment Engine
// Local state management for fulfillment jobs and contract ops.
// In production these would persist to Supabase; for now uses
// module-level storage that survives the Node.js process lifetime.
// ═══════════════════════════════════════════════════════════════════

import { FulfillmentJob, FulfillmentStatus, ContractOp, ContractStatus, AICategory } from "@/types/tender";

// ─── In-process store (replace with Supabase in production) ──────────────────

const jobStore = new Map<string, FulfillmentJob>();
const contractStore = new Map<string, ContractOp>();

// Seed some demo contracts so Ops page is immediately useful
const DEMO_CONTRACTS: ContractOp[] = [
  {
    id: "c-001",
    tenderId: "t-mock-1",
    externalId: "CB-2025-0441",
    title: "French/English Translation Services — ESDC Communications",
    department: "Employment and Social Development Canada",
    category: "TRANSLATION",
    contractValue: 48500,
    bidPrice: 39800,
    wonDate: "2026-01-15",
    startDate: "2026-02-01",
    deliverableDue: "2026-03-28",
    deliverableDescription: "Translated versions of 14 policy guidance documents (EN→FR and FR→EN)",
    status: "in_fulfillment",
    marginPercent: 71,
    aiCostActual: 42,
    notes: "Client requested minor style adjustments on docs 3-5. Resubmitted 2026-03-10.",
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "c-002",
    tenderId: "t-mock-2",
    externalId: "CB-2025-0312",
    title: "Environmental Impact Research Report — NRCan",
    department: "Natural Resources Canada",
    category: "WRITING",
    contractValue: 75000,
    bidPrice: 61500,
    wonDate: "2025-12-10",
    startDate: "2026-01-05",
    deliverableDue: "2026-04-15",
    deliverableDescription: "120-page research report on AI applications in resource extraction environmental monitoring",
    status: "active",
    marginPercent: 68,
    aiCostActual: 185,
    notes: "",
    createdAt: "2025-12-10T14:00:00Z",
  },
  {
    id: "c-003",
    tenderId: "t-mock-3",
    externalId: "CB-2025-0198",
    title: "Employee Training Materials — TBS Digital Academy",
    department: "Treasury Board Secretariat",
    category: "TRAINING",
    contractValue: 32000,
    bidPrice: 26200,
    wonDate: "2025-11-22",
    startDate: "2025-12-01",
    deliverableDue: "2026-02-28",
    deliverableDescription: "6-module eLearning curriculum on AI literacy for federal public servants",
    status: "invoiced",
    invoiceNumber: "INV-2026-003",
    invoiceDate: "2026-03-01",
    marginPercent: 74,
    aiCostActual: 95,
    notes: "Delivered 3 days early. Client very satisfied.",
    createdAt: "2025-11-22T09:00:00Z",
  },
  {
    id: "c-004",
    tenderId: "t-mock-4",
    externalId: "CB-2024-2891",
    title: "Public Consultation Survey Design & Analysis — HC",
    department: "Health Canada",
    category: "SURVEY",
    contractValue: 28000,
    bidPrice: 23000,
    wonDate: "2025-09-05",
    startDate: "2025-09-15",
    deliverableDue: "2025-11-30",
    deliverableDescription: "Survey design, administration support, and statistical analysis report for national health policy consultation",
    status: "paid",
    invoiceNumber: "INV-2025-017",
    invoiceDate: "2025-12-05",
    paidDate: "2025-12-28",
    marginPercent: 76,
    aiCostActual: 67,
    notes: "Repeat client — follow-up contract likely.",
    createdAt: "2025-09-05T11:00:00Z",
  },
];

// Initialize demo data
DEMO_CONTRACTS.forEach((c) => contractStore.set(c.id, c));

// ─── Fulfillment Job CRUD ─────────────────────────────────────────────────────

export function createJob(data: Omit<FulfillmentJob, "id" | "status" | "output" | "agentLog" | "createdAt">): FulfillmentJob {
  const job: FulfillmentJob = {
    ...data,
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    output: "",
    agentLog: [],
    createdAt: new Date().toISOString(),
  };
  jobStore.set(job.id, job);
  return job;
}

export function getJob(id: string): FulfillmentJob | undefined {
  return jobStore.get(id);
}

export function listJobs(): FulfillmentJob[] {
  return Array.from(jobStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function updateJob(id: string, patch: Partial<FulfillmentJob>): FulfillmentJob | null {
  const job = jobStore.get(id);
  if (!job) return null;
  const updated = { ...job, ...patch };
  jobStore.set(id, updated);
  return updated;
}

export function setJobStatus(id: string, status: FulfillmentStatus): FulfillmentJob | null {
  return updateJob(id, { status });
}

// ─── Contract Ops CRUD ────────────────────────────────────────────────────────

export function createContract(data: Omit<ContractOp, "id" | "createdAt">): ContractOp {
  const contract: ContractOp = {
    ...data,
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  contractStore.set(contract.id, contract);
  return contract;
}

export function getContract(id: string): ContractOp | undefined {
  return contractStore.get(id);
}

export function listContracts(): ContractOp[] {
  return Array.from(contractStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function updateContract(id: string, patch: Partial<ContractOp>): ContractOp | null {
  const contract = contractStore.get(id);
  if (!contract) return null;
  const updated = { ...contract, ...patch };
  contractStore.set(id, updated);
  return updated;
}

export function deleteContract(id: string): boolean {
  return contractStore.delete(id);
}

// ─── Ops Summary ──────────────────────────────────────────────────────────────

export function getOpsSummary() {
  const contracts = listContracts();
  const active = contracts.filter((c) => ["active", "in_fulfillment"].includes(c.status));
  const invoiced = contracts.filter((c) => ["invoiced", "paid"].includes(c.status));
  const paid = contracts.filter((c) => c.status === "paid");

  const totalContractValue = active.reduce((s, c) => s + c.bidPrice, 0);
  const totalInvoiced = invoiced.reduce((s, c) => s + c.bidPrice, 0);
  const totalPaid = paid.reduce((s, c) => s + c.bidPrice, 0);
  const avgMarginPercent =
    contracts.length > 0
      ? Math.round(contracts.reduce((s, c) => s + c.marginPercent, 0) / contracts.length)
      : 0;

  const now = new Date();
  const upcomingDeadlines = contracts
    .filter((c) => {
      const due = new Date(c.deliverableDue);
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 30 && ["active", "in_fulfillment"].includes(c.status);
    })
    .sort((a, b) => new Date(a.deliverableDue).getTime() - new Date(b.deliverableDue).getTime());

  return {
    activeContracts: active.length,
    totalContractValue,
    totalInvoiced,
    totalPaid,
    avgMarginPercent,
    upcomingDeadlines,
  };
}

// ─── Category display helpers ─────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<AICategory, string> = {
  TRANSLATION: "Translation",
  WRITING: "Research & Writing",
  DATA_ANALYSIS: "Data Analysis",
  TRANSCRIPTION: "Transcription",
  DOCUMENT_REVIEW: "Document Review",
  COMMS: "Communications",
  TRAINING: "Training Materials",
  SURVEY: "Survey & Analysis",
  IT_CONSULTING: "IT Advisory",
  POLICY: "Policy Research",
  AUDIT: "Compliance Audit",
  TESTING: "Software Testing",
};

export const STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Active",
  in_fulfillment: "In Fulfillment",
  delivered: "Delivered",
  invoiced: "Invoiced",
  paid: "Paid",
  closed: "Closed",
};

export const STATUS_COLORS: Record<ContractStatus, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200",
  in_fulfillment: "bg-violet-50 text-violet-700 border-violet-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  invoiced: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  closed: "bg-gray-50 text-gray-500 border-gray-200",
};
