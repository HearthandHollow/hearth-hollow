import { NextRequest, NextResponse } from "next/server";

/**
 * Host-based routing for the Skydive Weather micro-site.
 *
 * Requests arriving on skydive-weather.thehearthhollow.com are rewritten onto
 * the /skydive/* pages of this same app, so the subdomain feels like its own
 * site (skydive-weather.../dashboard → app/skydive/dashboard). API calls and
 * Next internals pass through untouched — /api/skydive/* works on both hosts.
 * All other hostnames (thehearthhollow.com, Vercel previews, localhost) are
 * completely unaffected.
 */

const SKYDIVE_HOST_PREFIX = "skydive-weather.";

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  if (!host.startsWith(SKYDIVE_HOST_PREFIX)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/skydive")) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? "/skydive" : `/skydive${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip API routes, Next internals, and static files (anything with a dot).
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};
