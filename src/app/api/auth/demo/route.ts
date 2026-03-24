import { NextRequest, NextResponse } from "next/server";

const DEMO_EMAIL = "demo@govbot.ai";
const DEMO_PASSWORD = "demo1234";
const DEMO_SESSION_COOKIE = "govbot-demo-session";

export async function POST(req: NextRequest) {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo mode is not enabled" }, { status: 403 });
  }

  const { email, password } = await req.json();

  if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
    const response = NextResponse.json({
      success: true,
      user: { email: DEMO_EMAIL, name: "Demo User", company: "GovBot AI Solutions Inc." },
    });

    response.cookies.set(DEMO_SESSION_COOKIE, "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  }

  return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(DEMO_SESSION_COOKIE);
  return response;
}
