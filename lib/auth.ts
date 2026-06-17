import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Admin session auth.
 *
 * The session cookie holds a signed token of the form `<expiry>.<hmac>`, where
 * the HMAC is computed over the expiry with a server-side secret. Because the
 * value cannot be produced without the secret, the cookie can no longer be
 * forged by simply setting `admin_session=authenticated` in the browser.
 */

export const ADMIN_COOKIE = "admin_session";
export const ADMIN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, in seconds

function getSecret(): string {
  // Prefer a dedicated secret; fall back to ADMIN_PASSWORD so the app keeps
  // working until SESSION_SECRET is configured. Setting SESSION_SECRET is
  // strongly recommended.
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error(
      "Neither SESSION_SECRET nor ADMIN_PASSWORD is set; cannot sign admin sessions."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/** Create a fresh signed session token. */
export function createSessionToken(): string {
  const expiry = String(Date.now() + ADMIN_COOKIE_MAX_AGE * 1000);
  return `${expiry}.${sign(expiry)}`;
}

/**
 * Action tokens authorize a specific one-off action (e.g. approving a quote)
 * embedded in an emailed link. The token is an HMAC over `<scope>` so it can't
 * be guessed or forged without the server secret.
 */
export function createActionToken(scope: string): string {
  return sign(`action:${scope}`);
}

export function verifyActionToken(
  scope: string,
  token: string | undefined | null
): boolean {
  if (!token) return false;
  let expected: string;
  try {
    expected = sign(`action:${scope}`);
  } catch {
    return false;
  }
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Verify a session token's signature and expiry. */
export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return false;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;

  const expiry = Number(payload);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  return true;
}

/** Read the admin cookie and verify it. Use this in API routes. */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(ADMIN_COOKIE)?.value);
}
