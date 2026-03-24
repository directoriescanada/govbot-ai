// ═══════════════════════════════════════════════════════════════════
// GovBot AI — API Utilities: Auth, Rate Limiting, Validation
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── Authentication ─────────────────────────────────────────────

export async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401 }
  );
}

// ─── Rate Limiting (in-memory, per-IP) ──────────────────────────

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  classify: { maxRequests: 10, windowMs: 60_000 },
  "bid-generate": { maxRequests: 5, windowMs: 60_000 },
  tenders: { maxRequests: 60, windowMs: 60_000 },
  default: { maxRequests: 30, windowMs: 60_000 },
};

export function checkRateLimit(
  request: NextRequest,
  endpoint: string
): { allowed: boolean; remaining: number } {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const key = `${ip}:${endpoint}`;
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1 };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count };
}

export function rateLimitResponse(remaining: number) {
  return NextResponse.json(
    { error: "Rate limit exceeded. Please try again later." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Remaining": String(remaining),
        "Retry-After": "60",
      },
    }
  );
}

// Clean up stale entries every 5 minutes
if (typeof globalThis !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) rateLimitStore.delete(key);
    }
  }, 300_000);
}

// ─── Input Validation ───────────────────────────────────────────

export function validateString(
  value: unknown,
  fieldName: string,
  options: { required?: boolean; maxLength?: number; minLength?: number } = {}
): { valid: boolean; error?: string; value: string } {
  const { required = false, maxLength = 10000, minLength = 0 } = options;

  if (value === undefined || value === null || value === "") {
    if (required) return { valid: false, error: `${fieldName} is required`, value: "" };
    return { valid: true, value: "" };
  }

  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string`, value: "" };
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters`, value: "" };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} must be at most ${maxLength} characters`, value: "" };
  }

  return { valid: true, value: trimmed };
}

export function validateNumber(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number; defaultValue?: number } = {}
): { valid: boolean; error?: string; value: number } {
  const { min = 0, max = 100_000_000, defaultValue } = options;

  if (value === undefined || value === null || value === "") {
    if (defaultValue !== undefined) return { valid: true, value: defaultValue };
    return { valid: true, value: 0 };
  }

  const num = typeof value === "string" ? parseFloat(value) : Number(value);

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a valid number`, value: defaultValue ?? 0 };
  }

  if (num < min || num > max) {
    return { valid: false, error: `${fieldName} must be between ${min} and ${max}`, value: defaultValue ?? 0 };
  }

  return { valid: true, value: num };
}

// ─── Safe search query sanitization ─────────────────────────────

export function sanitizeSearchQuery(query: string): string {
  // Remove characters that could be used for SQL injection or Supabase filter manipulation
  return query
    .replace(/[%_\\'"`;()]/g, "")
    .trim()
    .slice(0, 200);
}
