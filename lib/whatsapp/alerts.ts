// New-message alerts for Hunter. Email via Resend (Hunter: "email for now").
// Batched per conversation: one email, then quiet for WHATSAPP_ALERT_QUIET_MIN
// (default 15) while the thread stays unread, so a chatty thread doesn't spam.
// Optional in-app bell + web push behind WHATSAPP_ALERT_PUSH=true (off by default).
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { getBaseUrl } from "@/lib/site";
import { PROJECT_LABELS, isProject, maskNumber } from "./core";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || "support@thehearthhollow.com";
const TO = process.env.WHATSAPP_ALERT_EMAIL || "hunterhammond@thehearthhollow.com";
const QUIET_MS = Math.max(1, Number(process.env.WHATSAPP_ALERT_QUIET_MIN || 15)) * 60_000;

export async function maybeAlert(conversationId: string): Promise<boolean> {
  const c = await prisma.waConversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      messages: { where: { direction: "in" }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!c || c.unreadCount === 0) return false;
  if (c.alertedAt && Date.now() - c.alertedAt.getTime() < QUIET_MS) return false;

  const who = c.contact.profileName || `WhatsApp ${maskNumber(c.contact.waId)}`;
  const proj = c.project && isProject(c.project) ? PROJECT_LABELS[c.project] : "Untagged";
  const url = `${getBaseUrl()}/admin/messages?c=${c.id}`;
  const lines = [...c.messages].reverse().map((m) => `• ${m.body ? m.body.slice(0, 300) : `[${m.type}]`}`);
  const subject = `WhatsApp: ${who} (${proj}) — ${c.unreadCount} new`;
  const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch] as string));

  // Claim the alert slot first so concurrent webhooks don't double-send.
  const claimed = await prisma.waConversation.updateMany({
    where: { id: c.id, OR: [{ alertedAt: null }, { alertedAt: { lt: new Date(Date.now() - QUIET_MS) } }] },
    data: { alertedAt: new Date() },
  });
  if (claimed.count === 0) return false;

  try {
    // Resend returns { error } instead of throwing — check it so a failed alert is visible.
    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      subject,
      text: `${who} — ${proj}\n\n${lines.join("\n")}\n\nOpen the inbox: ${url}\n`,
      html: `<p><strong>${esc(who)}</strong> — ${esc(proj)}</p><p>${lines.map(esc).join("<br>")}</p><p><a href="${url}">Open the inbox</a></p><p style="color:#888;font-size:12px">More messages in this thread won't email again for ${QUIET_MS / 60000} minutes.</p>`,
    });
    if (error) console.error("[whatsapp] alert email failed:", error.message || error.name);
  } catch (e) {
    console.error("[whatsapp] alert email failed:", e instanceof Error ? e.message : e);
  }
  if ((process.env.WHATSAPP_ALERT_PUSH || "").toLowerCase() === "true") {
    await createNotification({ type: "whatsapp", title: "New WhatsApp message", message: `${who} — ${proj}`, url: `/admin/messages?c=${c.id}` });
  }
  return true;
}
