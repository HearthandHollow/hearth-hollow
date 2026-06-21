/**
 * Server-side Web Push sender (native, self-hosted — replaces OneSignal).
 *
 * Why this exists: OneSignal stored our browser subscriptions WITHOUT the
 * web-push encryption keys (p256dh / auth). It would report sends as
 * "successful" because the request to FCM was accepted, but Chrome silently
 * discarded every undecryptable payload, so nothing ever displayed on any
 * device. Sending Web Push ourselves — straight from this server to the
 * browser's own push subscription, encrypted with the subscription's real
 * keys via VAPID — removes that broken middleman entirely.
 *
 * Subscriptions live in the `PushSubscription` table (saved by
 * /api/admin/push/subscribe). There's only ever one admin (Hunter), but this
 * happily fans out to every device he's enabled.
 *
 * No-ops quietly (logs only) if the VAPID env vars aren't configured, or if no
 * device is currently subscribed, so dev environments and any misconfiguration
 * never break the calling request flow. All call sites treat this as
 * best-effort.
 */

import webpush from "web-push";
import { prisma } from "./prisma";

const DEFAULT_SUBJECT = "mailto:support@thehearthhollow.com";

let vapidReady = false;

function ensureVapid(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || DEFAULT_SUBJECT,
      publicKey,
      privateKey
    );
    vapidReady = true;
  }
  return true;
}

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendAdminPush(opts: {
  title: string;
  message: string;
  url?: string;
}): Promise<void> {
  if (!ensureVapid()) {
    console.log("[push] VAPID not configured, skipping push:", opts.title);
    return;
  }

  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) {
    console.log("[push] no device subscribed, skipping push:", opts.title);
    return;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.thehearthhollow.com";
  const url = opts.url
    ? new URL(opts.url, baseUrl).toString()
    : `${baseUrl.replace(/\/$/, "")}/admin/dashboard`;

  const payload = JSON.stringify({
    title: opts.title,
    body: opts.message,
    url,
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 }
        );
      } catch (err: any) {
        const code = err?.statusCode;
        // 404 / 410 mean the subscription is gone (unsubscribed / expired) —
        // prune it so it doesn't accumulate dead rows or repeat errors.
        if (code === 404 || code === 410) {
          await prisma.pushSubscription
            .delete({ where: { endpoint: s.endpoint } })
            .catch(() => {});
          console.log("[push] pruned expired subscription:", code);
        } else {
          console.error(
            "[push] send failed:",
            code,
            err?.body || err?.message || err
          );
        }
      }
    })
  );
}
