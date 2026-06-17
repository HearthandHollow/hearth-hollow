/**
 * Lightweight in-memory rate limiter (fixed window).
 *
 * NOTE: state lives in the process memory of a single serverless instance, so
 * it is best-effort — it slows bursts against a warm instance but is not a
 * global guarantee across all instances. For strict, durable limits use a
 * shared store (e.g. Upstash Redis / Vercel KV). This is a sensible speed bump
 * for a low-traffic public form.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (when blocked). */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from common proxy headers. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
