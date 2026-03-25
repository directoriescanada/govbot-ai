// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Fulfillment Engine
// Manages fulfillment jobs and contract ops.
// Uses Supabase when configured, falls back to in-memory Maps.
// ═══════════════════════════════════════════════════════════════════

import { FulfillmentJob, FulfillmentStatus, ContractOp, ContractStatus, AICategory } from "@/types/tender";
import { useSupabase } from "@/lib/db";
// Dynamic import to avoid bundling server-only code into client components
async function getServiceClient() {
  const { createServiceClient } = await import("@/lib/supabase/server");
  return createServiceClient();
}

// ─── In-process store (demo-mode fallback) ──────────────────────────────────

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

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToJob(row: Record<string, unknown>): FulfillmentJob {
  return {
    id: row.id as string,
    tenderId: row.tender_id as string,
    tenderTitle: row.tender_title as string,
    department: (row.department as string) ?? "",
    category: (row.category as string) as AICategory,
    status: row.status as FulfillmentStatus,
    brief: (row.brief as string) ?? "",
    inputContent: (row.input_content as string) ?? "",
    output: (row.output as string) ?? "",
    reviewNotes: (row.review_notes as string) ?? "",
    estimatedAICost: Number(row.estimated_ai_cost ?? 0),
    agentLog: (row.agent_log as string[]) ?? [],
    createdAt: row.created_at ? String(row.created_at) : "",
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  };
}

function rowToContract(row: Record<string, unknown>): ContractOp {
  return {
    id: row.id as string,
    tenderId: row.tender_id as string,
    externalId: (row.external_id as string) ?? undefined,
    title: row.title as string,
    department: (row.department as string) ?? "",
    category: (row.category as string) as AICategory,
    contractValue: Number(row.contract_value ?? 0),
    bidPrice: Number(row.bid_price ?? 0),
    wonDate: row.won_date ? String(row.won_date) : "",
    startDate: row.start_date ? String(row.start_date) : "",
    deliverableDue: row.deliverable_due ? String(row.deliverable_due) : "",
    deliverableDescription: (row.deliverable_description as string) ?? "",
    status: row.status as ContractStatus,
    fulfillmentJobId: (row.fulfillment_job_id as string) ?? undefined,
    invoiceNumber: (row.invoice_number as string) ?? undefined,
    invoiceDate: row.invoice_date ? String(row.invoice_date) : undefined,
    paidDate: row.paid_date ? String(row.paid_date) : undefined,
    marginPercent: Number(row.margin_percent ?? 0),
    aiCostActual: Number(row.ai_cost_actual ?? 0),
    notes: (row.notes as string) ?? "",
    createdAt: row.created_at ? String(row.created_at) : "",
  };
}

// ─── Fulfillment Job CRUD ─────────────────────────────────────────────────────

export async function createJob(data: Omit<FulfillmentJob, "id" | "status" | "output" | "agentLog" | "createdAt">): Promise<FulfillmentJob> {
  const job: FulfillmentJob = {
    ...data,
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    output: "",
    agentLog: [],
    createdAt: new Date().toISOString(),
  };

  if (!useSupabase()) {
    jobStore.set(job.id, job);
    return job;
  }

  const sb = await getServiceClient();
  const { data: row, error } = await sb
    .from("fulfillment_jobs")
    .insert({
      id: job.id,
      tender_id: job.tenderId,
      tender_title: job.tenderTitle,
      department: job.department,
      category: job.category,
      status: job.status,
      brief: job.brief,
      input_content: job.inputContent,
      output: job.output,
      review_notes: job.reviewNotes ?? "",
      estimated_ai_cost: job.estimatedAICost ?? 0,
      agent_log: job.agentLog,
      created_at: job.createdAt,
    })
    .select()
    .single();
  if (error || !row) {
    console.error("Supabase fulfillment_jobs insert error:", error);
    // fallback to in-memory
    jobStore.set(job.id, job);
    return job;
  }
  return rowToJob(row);
}

export async function getJob(id: string): Promise<FulfillmentJob | undefined> {
  if (!useSupabase()) {
    return jobStore.get(id);
  }
  const sb = await getServiceClient();
  const { data, error } = await sb.from("fulfillment_jobs").select("*").eq("id", id).single();
  if (error || !data) return undefined;
  return rowToJob(data);
}

export async function listJobs(): Promise<FulfillmentJob[]> {
  if (!useSupabase()) {
    return Array.from(jobStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  const sb = await getServiceClient();
  const { data, error } = await sb
    .from("fulfillment_jobs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToJob);
}

export async function updateJob(id: string, patch: Partial<FulfillmentJob>): Promise<FulfillmentJob | null> {
  if (!useSupabase()) {
    const job = jobStore.get(id);
    if (!job) return null;
    const updated = { ...job, ...patch };
    jobStore.set(id, updated);
    return updated;
  }

  // Map camelCase patch to snake_case
  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.output !== undefined) dbPatch.output = patch.output;
  if (patch.reviewNotes !== undefined) dbPatch.review_notes = patch.reviewNotes;
  if (patch.estimatedAICost !== undefined) dbPatch.estimated_ai_cost = patch.estimatedAICost;
  if (patch.agentLog !== undefined) dbPatch.agent_log = patch.agentLog;
  if (patch.completedAt !== undefined) dbPatch.completed_at = patch.completedAt;
  if (patch.brief !== undefined) dbPatch.brief = patch.brief;
  if (patch.inputContent !== undefined) dbPatch.input_content = patch.inputContent;

  const sb = await getServiceClient();
  const { data, error } = await sb
    .from("fulfillment_jobs")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return null;
  return rowToJob(data);
}

export async function setJobStatus(id: string, status: FulfillmentStatus): Promise<FulfillmentJob | null> {
  return updateJob(id, { status });
}

// ─── Contract Ops CRUD ────────────────────────────────────────────────────────

export async function createContract(data: Omit<ContractOp, "id" | "createdAt">): Promise<ContractOp> {
  const contract: ContractOp = {
    ...data,
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  if (!useSupabase()) {
    contractStore.set(contract.id, contract);
    return contract;
  }

  const sb = await getServiceClient();
  const { data: row, error } = await sb
    .from("contracts")
    .insert({
      id: contract.id,
      tender_id: contract.tenderId,
      external_id: contract.externalId ?? null,
      title: contract.title,
      department: contract.department,
      category: contract.category,
      contract_value: contract.contractValue,
      bid_price: contract.bidPrice,
      won_date: contract.wonDate ?? null,
      start_date: contract.startDate ?? null,
      deliverable_due: contract.deliverableDue || null,
      deliverable_description: contract.deliverableDescription ?? "",
      status: contract.status,
      fulfillment_job_id: contract.fulfillmentJobId ?? null,
      invoice_number: contract.invoiceNumber ?? null,
      invoice_date: contract.invoiceDate ?? null,
      paid_date: contract.paidDate ?? null,
      margin_percent: contract.marginPercent,
      ai_cost_actual: contract.aiCostActual,
      notes: contract.notes,
      created_at: contract.createdAt,
    })
    .select()
    .single();
  if (error || !row) {
    console.error("Supabase contracts insert error:", error);
    contractStore.set(contract.id, contract);
    return contract;
  }
  return rowToContract(row);
}

export async function getContract(id: string): Promise<ContractOp | undefined> {
  if (!useSupabase()) {
    return contractStore.get(id);
  }
  const sb = await getServiceClient();
  const { data, error } = await sb.from("contracts").select("*").eq("id", id).single();
  if (error || !data) return undefined;
  return rowToContract(data);
}

export async function listContracts(): Promise<ContractOp[]> {
  if (!useSupabase()) {
    return Array.from(contractStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  const sb = await getServiceClient();
  const { data, error } = await sb
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToContract);
}

export async function updateContract(id: string, patch: Partial<ContractOp>): Promise<ContractOp | null> {
  if (!useSupabase()) {
    const contract = contractStore.get(id);
    if (!contract) return null;
    const updated = { ...contract, ...patch };
    contractStore.set(id, updated);
    return updated;
  }

  // Map camelCase patch to snake_case
  const dbPatch: Record<string, unknown> = {};
  if (patch.tenderId !== undefined) dbPatch.tender_id = patch.tenderId;
  if (patch.externalId !== undefined) dbPatch.external_id = patch.externalId;
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.department !== undefined) dbPatch.department = patch.department;
  if (patch.category !== undefined) dbPatch.category = patch.category;
  if (patch.contractValue !== undefined) dbPatch.contract_value = patch.contractValue;
  if (patch.bidPrice !== undefined) dbPatch.bid_price = patch.bidPrice;
  if (patch.wonDate !== undefined) dbPatch.won_date = patch.wonDate;
  if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate;
  if (patch.deliverableDue !== undefined) dbPatch.deliverable_due = patch.deliverableDue;
  if (patch.deliverableDescription !== undefined) dbPatch.deliverable_description = patch.deliverableDescription;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.fulfillmentJobId !== undefined) dbPatch.fulfillment_job_id = patch.fulfillmentJobId;
  if (patch.invoiceNumber !== undefined) dbPatch.invoice_number = patch.invoiceNumber;
  if (patch.invoiceDate !== undefined) dbPatch.invoice_date = patch.invoiceDate;
  if (patch.paidDate !== undefined) dbPatch.paid_date = patch.paidDate;
  if (patch.marginPercent !== undefined) dbPatch.margin_percent = patch.marginPercent;
  if (patch.aiCostActual !== undefined) dbPatch.ai_cost_actual = patch.aiCostActual;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;

  const sb = await getServiceClient();
  const { data, error } = await sb
    .from("contracts")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return null;
  return rowToContract(data);
}

export async function deleteContract(id: string): Promise<boolean> {
  if (!useSupabase()) {
    return contractStore.delete(id);
  }
  const sb = await getServiceClient();
  const { error } = await sb.from("contracts").delete().eq("id", id);
  return !error;
}

// ─── Ops Summary ──────────────────────────────────────────────────────────────

export async function getOpsSummary() {
  const contracts = await listContracts();
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
