/**
 * Server-side OneSignal push sender. There's only ever one admin subscriber
 * (Hunter), so no per-user device tracking is needed — but targeting the
 * dashboard's dynamic "Subscribed Users" segment proved unreliable: it can
 * lag behind a just-created subscription (segment membership is indexed
 * async, not updated the instant a device opts in) and it also matched a
 * stray non-push "player" record (an email-channel identifier, not an actual
 * push subscription) sitting in the same app. Both caused the segment-based
 * send to report "All included players are not subscribed" / silently miss
 * the real device even though the device WAS opted in.
 *
 * Fix: look up actual push-capable player records directly via the Players
 * API and target them by id with include_player_ids. This was verified
 * against the live OneSignal app to deliver successfully where the segment
 * send did not.
 *
 * No-ops quietly (logs only) if OneSignal env vars aren't configured, or if
 * no push-capable player is currently registered, so local/dev environments
 * and any misconfiguration never break the calling request flow. All call
 * sites treat this as best-effort.
 */

const ONESIGNAL_NOTIFICATIONS_API = "https://onesignal.com/api/v1/notifications";
const ONESIGNAL_PLAYERS_API = "https://onesignal.com/api/v1/players";

// OneSignal player `device_type` values that represent an actual web/mobile
// push subscription. Notably excludes 11 (Email) and 14 (SMS) — those are
// other OneSignal channels that can show up as "players" on the same app
// but can't receive a push notification.
const PUSH_DEVICE_TYPES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13]);

export function isPushConfigured(): boolean {
  return !!(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY);
}

async function getPushCapablePlayerIds(appId: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${ONESIGNAL_PLAYERS_API}?app_id=${appId}&limit=50`, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`OneSignal players lookup failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const players: any[] = data?.players ?? [];
  return players
    .filter((p) => !p.invalid_identifier && PUSH_DEVICE_TYPES.has(p.device_type))
    .map((p) => p.id);
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

  const playerIds = await getPushCapablePlayerIds(appId, apiKey);
  if (playerIds.length === 0) {
    console.log("[push] no push-capable subscriber registered, skipping push:", opts.title);
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://thehearthhollow.com";
  const url = opts.url
    ? new URL(opts.url, baseUrl).toString()
    : undefined;

  const res = await fetch(ONESIGNAL_NOTIFICATIONS_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_player_ids: playerIds,
      headings: { en: opts.title },
      contents: { en: opts.message },
      ...(url ? { url } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`OneSignal push failed: ${res.status} ${await res.text()}`);
  }
}
