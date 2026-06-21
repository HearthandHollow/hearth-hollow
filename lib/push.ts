/**
 * Server-side OneSignal push sender. Targets the "Subscribed Users" segment
 * rather than a stored player ID — there's only ever one admin subscriber
 * (Hunter), so no per-user device tracking is needed.
 *
 * No-ops quietly (logs only) if OneSignal env vars aren't configured, so
 * local/dev environments and any misconfiguration never break the calling
 * request flow. All call sites treat this as best-effort.
 */

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

export function isPushConfigured(): boolean {
  return !!(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY);
}

export async function sendAdminPush(opts: {
  title: string;
  message: string;
  url?: string;
}): Promise<void> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    console.log("[push] OneSignal not configured, skipping push:", opts.title);
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://thehearthhollow.com";
  const url = opts.url
    ? new URL(opts.url, baseUrl).toString()
    : undefined;

  const res = await fetch(ONESIGNAL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      included_segments: ["Subscribed Users"],
      headings: { en: opts.title },
      contents: { en: opts.message },
      ...(url ? { url } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`OneSignal push failed: ${res.status} ${await res.text()}`);
  }
}
