/**
 * In-app notification center, backed by the Notification table. Surfaced via
 * the bell dropdown in the admin layout (app/admin/components/NotificationBell.tsx).
 *
 * This exists alongside the OneSignal push integration (lib/push.ts), not as
 * a replacement — push is for when the admin isn't looking at the app at
 * all; this is the reliable in-app feed that doesn't depend on a browser
 * service worker, FCM delivery, or OS notification permissions, all of which
 * turned out to be fragile on at least one real device. Every call site that
 * sends a push should also create a Notification record.
 */

import { prisma } from "./prisma";

export async function createNotification(opts: {
  type: "new_request" | "email_reply" | "booking";
  title: string;
  message: string;
  url?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        type: opts.type,
        title: opts.title,
        message: opts.message,
        url: opts.url,
      },
    });
  } catch (err) {
    // Best-effort, same as push — never let a notification-log failure break
    // the calling request flow.
    console.error("[notifications] failed to create notification:", err);
  }
}
