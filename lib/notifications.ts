/**
 * In-app notification center, backed by the Notification table. Surfaced via
 * the bell dropdown in the admin layout (app/admin/components/NotificationBell.tsx).
 *
 * This is the single entry point for "something happened, tell the admin."
 * Every call creates the in-app Notification record (reliable, doesn't
 * depend on a browser service worker, FCM delivery, or OS permissions) AND
 * fires the Web Push (lib/push.ts) for when the admin isn't looking at
 * the app at all. Callers should only ever call createNotification — they
 * don't need to call sendAdminPush separately.
 */

import { prisma } from "./prisma";
import { sendAdminPush } from "./push";

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
    // Best-effort — never let a notification-log failure break the calling
    // request flow.
    console.error("[notifications] failed to create notification:", err);
  }

  // Gather the unread count (for the app-icon badge) and the configured app
  // icon (for the notification image) — both best-effort.
  let badgeCount: number | undefined;
  let icon: string | undefined;
  try {
    badgeCount = await prisma.notification.count({ where: { viewedAt: null } });
  } catch {
    /* ignore */
  }
  try {
    const theme = await prisma.themeSettings.findFirst();
    if (theme?.appIconUrl) icon = theme.appIconUrl;
  } catch {
    /* ignore */
  }

  try {
    await sendAdminPush({
      title: opts.title,
      message: opts.message,
      url: opts.url,
      badgeCount,
      icon,
    });
  } catch (err) {
    // Best-effort — push delivery is a bonus channel, never block on it.
    console.error("[notifications] failed to send push:", err);
  }
}
