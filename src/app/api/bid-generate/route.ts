import { NextRequest, NextResponse } from "next/server";
import { generateBidResponse } from "@/lib/claude";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  checkRateLimit,
  rateLimitResponse,
  validateString,
  validateNumber,
} from "@/lib/api-utils";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  // Auth check
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  // Rate limit
  const rateCheck = checkRateLimit(request, "bid-generate");
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.remaining);

  try {
    const body = await request.json();

    // Validate inputs
    const title = validateString(body.title, "title", { required: true, maxLength: 500 });
    if (!title.valid) return NextResponse.json({ error: title.error }, { status: 400 });

    const description = validateString(body.description, "description", { required: true, maxLength: 15000 });
    if (!description.valid) return NextResponse.json({ error: description.error }, { status: 400 });

    const department = validateString(body.department, "department", { maxLength: 300 });
    const requirements = validateString(body.requirements, "requirements", { maxLength: 10000 });
    const estimatedValue = validateNumber(body.estimatedValue, "estimatedValue", { min: 1000, max: 100_000_000, defaultValue: 100000 });

    const result = await generateBidResponse(
      title.value,
      description.value,
      department.value,
      requirements.value,
      estimatedValue.value
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Bid generation error:", error);
    return NextResponse.json(
      { error: "Bid generation failed. Please try again." },
      { status: 500 }
    );
  }
}
