import { prisma } from "@/lib/prisma";

// Quote analysis is done by Brain (Claude Code, human-initiated) by default.
// The Anthropic API path (estimate + email-thread analysis) only runs when
// QUOTE_ANALYSIS_API_ENABLED=true, and even then at most
// QUOTE_ANALYSIS_API_DAILY_CAP calls per UTC day (default 5).
export function quoteApiEnabled(): boolean {
  return (process.env.QUOTE_ANALYSIS_API_ENABLED || "").trim().toLowerCase() === "true";
}

export function quoteApiDailyCap(): number {
  const n = parseInt(process.env.QUOTE_ANALYSIS_API_DAILY_CAP || "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

export type ApiGate = { ok: true } | { ok: false; status: number; error: string };

// Call before every Anthropic API request for quotes. Records the call when allowed.
export async function claimQuoteApiCall(kind: "estimate" | "email"): Promise<ApiGate> {
  if (!quoteApiEnabled()) {
    return {
      ok: false,
      status: 409,
      error: "API analysis is turned off. Use \"Queue for Brain\" and ask Brain for a draft.",
    };
  }
  if (!prisma) return { ok: false, status: 503, error: "Database not available" };
  const cap = quoteApiDailyCap();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const used = await prisma.aiUsage.count({ where: { createdAt: { gte: start } } });
  if (used >= cap) {
    return { ok: false, status: 429, error: `Daily API analysis cap reached (${cap}/day).` };
  }
  await prisma.aiUsage.create({ data: { kind } });
  return { ok: true };
}
