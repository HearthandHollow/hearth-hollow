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

  if (!process.env.SKYDIVE_ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
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

  // The research call runs 1-3+ minutes, but Cloudflare kills responses that
  // send no bytes for ~100s (the client then sees an HTML 524 page instead of
  // JSON). Stream the response: heartbeat lines keep the connection alive
  // while the search runs, then the final line carries the result.
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (line: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(line + "\n"));
        } catch {
          closed = true;
        }
      };
      const finish = (line: string) => {
        clearInterval(ping);
        send(line);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      };
      const ping = setInterval(() => send("PING"), 8000);
      send("PING");
      searchPlanes(input).then(
        (result) => finish("RESULT " + JSON.stringify(result)),
        (error: any) => {
          console.error("Plane search failed:", error);
          finish(
            "ERROR " +
              JSON.stringify({
                error: error?.message || "The search failed — please try again.",
              })
          );
        }
      );
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
