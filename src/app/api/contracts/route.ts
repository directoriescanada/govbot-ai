// ═══════════════════════════════════════════════════════════════════
// GET    /api/contracts  — List all contract ops
// POST   /api/contracts  — Create a new contract (mark tender as won)
// PATCH  /api/contracts  — Update contract status/fields
// DELETE /api/contracts  — Remove a contract
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import {
  createContract,
  listContracts,
  updateContract,
  deleteContract,
  getOpsSummary,
} from "@/lib/fulfillment";
import { ContractOp } from "@/types/tender";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const summary = searchParams.get("summary") === "true";

  if (summary) {
    return NextResponse.json(getOpsSummary());
  }

  const contracts = listContracts();
  return NextResponse.json({ data: contracts, total: contracts.length });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<ContractOp, "id" | "createdAt">;

    if (!body.tenderId || !body.title || !body.category) {
      return NextResponse.json(
        { error: "Missing required fields: tenderId, title, category" },
        { status: 400 }
      );
    }

    const contract = createContract({
      ...body,
      status: body.status || "active",
      marginPercent: body.marginPercent || 0,
      aiCostActual: body.aiCostActual || 0,
      notes: body.notes || "",
    });

    return NextResponse.json({ contract }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: string } & Partial<ContractOp>;
    const { id, ...patch } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing contract id" }, { status: 400 });
    }

    const updated = updateContract(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    return NextResponse.json({ contract: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing contract id" }, { status: 400 });
  }

  const deleted = deleteContract(id);
  if (!deleted) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
