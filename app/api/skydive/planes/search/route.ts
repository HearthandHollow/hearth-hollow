import { NextRequest, NextResponse } from "next/server";
import { getAuthedSkydiveUser } from "@/lib/skydive/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { searchPlanes, PlaneSearchInput } from "@/lib/skydive/plane-search";

export const dynamic = "force-dynamic";
// Research calls can run several minutes (matters on serverless; the forge
// node server has no such cap).
export const maxDuration = 300;

// Each search spends real Anthropic API money — keep the lid on tight.
const USER_LIMIT = 5; // per user per hour
const IP_LIMIT = 10; // per IP per hour
const WINDOW_MS = 60 * 60 * 1000;

const clamp = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const user = await getAuthedSkydiveUser(body.u, body.t);
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const userLimited = rateLimit(`plane-search:u:${user.id}`, USER_LIMIT, WINDOW_MS);
  const ipLimited = rateLimit(`plane-search:ip:${ip}`, IP_LIMIT, WINDOW_MS);
  if (!userLimited.ok || !ipLimited.ok) {
    const retryAfter = Math.max(userLimited.retryAfter ?? 0, ipLimited.retryAfter ?? 0);
    return NextResponse.json(
      { error: "Search limit reached — try again in a bit. Each search does a real deep dive, so they're capped at 5 per hour." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Plane search isn't configured on this server." },
      { status: 503 }
    );
  }

  const input: PlaneSearchInput = {
    intent: body.intent === "lease" ? "lease" : "buy",
    budget: clamp(body.budget, 100),
    capacity: clamp(body.capacity, 50),
    aircraftClass: clamp(body.aircraftClass, 50),
    region: clamp(body.region, 50),
    notes: clamp(body.notes, 500),
  };

  try {
    const result = await searchPlanes(input);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Plane search failed:", error);
    return NextResponse.json(
      { error: error?.message || "The search failed — please try again." },
      { status: 502 }
    );
  }
}
