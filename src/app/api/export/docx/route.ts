import { NextRequest, NextResponse } from "next/server";
import {
  generateBidDocx,
  generateDeliverableDocx,
} from "@/lib/docx-generator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.type || (body.type !== "bid" && body.type !== "deliverable")) {
      return NextResponse.json(
        { error: 'Invalid or missing "type" field. Must be "bid" or "deliverable".' },
        { status: 400 }
      );
    }

    if (body.type === "bid") {
      const {
        tenderTitle,
        tenderRef,
        department,
        closingDate,
        complianceMatrix,
        proposalSections,
        pricingModel,
        aboutUs,
      } = body;

      if (!tenderTitle || !tenderRef) {
        return NextResponse.json(
          { error: "Missing required fields: tenderTitle, tenderRef" },
          { status: 400 }
        );
      }

      const buffer = await generateBidDocx({
        tenderTitle,
        tenderRef,
        department,
        closingDate,
        complianceMatrix,
        proposalSections,
        pricingModel,
        aboutUs,
      });

      const sanitizedRef = tenderRef.replace(/[^a-zA-Z0-9-_]/g, "_");

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="GovBot-Bid-${sanitizedRef}.docx"`,
        },
      });
    }

    // type === "deliverable"
    const { title, department, contractRef, content, isDraft } = body;

    if (!title || !contractRef) {
      return NextResponse.json(
        { error: "Missing required fields: title, contractRef" },
        { status: 400 }
      );
    }

    const buffer = await generateDeliverableDocx({
      title,
      department,
      contractRef,
      content,
      isDraft,
    });

    const sanitizedRef = contractRef.replace(/[^a-zA-Z0-9-_]/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="GovBot-Deliverable-${sanitizedRef}.docx"`,
      },
    });
  } catch (error) {
    console.error("DOCX generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate document" },
      { status: 500 }
    );
  }
}
