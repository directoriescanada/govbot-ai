import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/signup", "/api/auth", "/api/cron/refresh", "/api/webhooks/stripe"];

// Demo mode credentials — set DEMO_MODE=true in .env.local to enable
const DEMO_MODE = process.env.DEMO_MODE === "true";
const DEMO_SESSION_COOKIE = "govbot-demo-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for public routes and static assets
  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  // ─── Demo Mode ───────────────────────────────────────────────────────────
  // When DEMO_MODE=true, login accepts demo@govbot.ai / demo1234
  // and sets a simple session cookie (no Supabase needed)
  if (DEMO_MODE) {
    const hasDemoSession = request.cookies.get(DEMO_SESSION_COOKIE)?.value === "authenticated";
    if (!hasDemoSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // ─── Production Mode (Supabase Auth) ─────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured, allow all access
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your_") || supabaseAnonKey.includes("your_")) {
    return response;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response = NextResponse.next({ request });
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user && (pathname === "/login" || pathname === "/signup")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch {
    // If Supabase is unreachable, allow access (graceful degradation)
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
