import { NextRequest, NextResponse } from "next/server";
import { classifyTender } from "@/lib/claude";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  checkRateLimit,
  rateLimitResponse,
  validateString,
  validateNumber,
} from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  // Auth check
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  // Rate limit
  const rateCheck = checkRateLimit(request, "classify");
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.remaining);

  try {
    const body = await request.json();

    // Validate inputs
    const title = validateString(body.title, "title", { required: true, maxLength: 500 });
    if (!title.valid) return NextResponse.json({ error: title.error }, { status: 400 });

    const description = validateString(body.description, "description", { required: true, maxLength: 10000 });
    if (!description.valid) return NextResponse.json({ error: description.error }, { status: 400 });

    const department = validateString(body.department, "department", { maxLength: 300 });
    const estimatedValue = validateNumber(body.estimatedValue, "estimatedValue", { min: 0, max: 100_000_000, defaultValue: 0 });
    const category = validateString(body.category, "category", { maxLength: 20 });

    const result = await classifyTender(
      title.value,
      description.value,
      department.value,
      estimatedValue.value,
      category.value || "SRV"
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Classification error:", error);
    return NextResponse.json(
      { error: "Classification failed. Please try again." },
      { status: 500 }
    );
  }
}
