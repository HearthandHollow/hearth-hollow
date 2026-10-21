// WhatsApp Comms Hub — persistence + rule-based automation. Brain, 2026-10-21.
// Rules (no AI anywhere): project tag from prefix or menu choice; one menu per untagged
// conversation; STOP/START handling; batched email alerts; media copied to private S3.
import { prisma } from "@/lib/prisma";
import { putPrivateObject } from "@/lib/s3";
import {
  InboundMessage, StatusUpdate, WaEvent, Project, PROJECT_LABELS,
  projectFromText, projectFromMenuReply, optKeyword, nextStatus, maskNumber,
} from "./core";
import { sendText, sendProjectMenu, downloadMedia, waConfigured } from "./graph";
import { maybeAlert } from "./alerts";

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export async function processEvents(events: WaEvent[]): Promise<{ messages: number; statuses: number; ignored: number }> {
  const allowed = process.env.WHATSAPP_PHONE_NUMBER_ID;
  let messages = 0, statuses = 0, ignored = 0;
  for (const ev of events) {
    // One app can see several numbers (e.g. Meta's test number); only handle ours.
    if (allowed && ev.phoneNumberId && ev.phoneNumberId !== allowed) { ignored++; continue; }
    try {
      if (ev.kind === "message") { if (await handleInbound(ev)) messages++; else ignored++; }
      else { await handleStatus(ev); statuses++; }
    } catch (e) {
      console.error(`[whatsapp] event failed (${ev.kind}):`, e instanceof Error ? e.message : e);
    }
  }
  return { messages, statuses, ignored };
}

async function handleInbound(m: InboundMessage): Promise<boolean> {
  if (!m.wamid || !m.from) return false;
  if (await prisma.waMessage.findUnique({ where: { wamid: m.wamid }, select: { id: true } })) return false; // Meta retries

  const keyword = m.type === "text" ? optKeyword(m.text) : null;
  const existing = await prisma.waContact.findUnique({ where: { waId: m.from } });
  // Messaging us first counts as opt-in, unless they previously sent STOP (then only START re-opts).
  const optData =
    keyword === "stop" ? { optedIn: false, optedOutAt: new Date() }
    : keyword === "start" ? { optedIn: true, optedInAt: new Date(), optedOutAt: null, optInSource: "inbound" }
    : !existing || (!existing.optedIn && !existing.optedOutAt) ? { optedIn: true, optedInAt: new Date(), optInSource: existing?.optInSource || "inbound" }
    : {};
  const contact = await prisma.waContact.upsert({
    where: { waId: m.from },
    create: { waId: m.from, profileName: m.profileName, ...optData },
    update: { ...(m.profileName ? { profileName: m.profileName } : {}), ...optData },
  });

  let conv = await prisma.waConversation.findFirst({
    where: { contactId: contact.id, status: "open" },
    orderBy: { lastMessageAt: "desc" },
  });
  if (!conv) conv = await prisma.waConversation.create({ data: { contactId: contact.id } });

  const menuChoice = projectFromMenuReply(m.replyId);
  const tagged: Project | null = conv.project ? null : (menuChoice || projectFromText(m.text));

  const msg = await prisma.waMessage.create({
    data: {
      conversationId: conv.id, direction: "in", type: m.type, body: m.text,
      mediaId: m.mediaId, mediaMime: m.mediaMime, wamid: m.wamid, status: "received", waTimestamp: m.timestamp,
    },
  });
  conv = await prisma.waConversation.update({
    where: { id: conv.id },
    data: {
      lastInboundAt: m.timestamp, lastMessageAt: new Date(), unreadCount: { increment: 1 },
      ...(tagged ? { project: tagged } : {}),
    },
  });
  if (tagged && !contact.projects.includes(tagged)) {
    await prisma.waContact.update({ where: { id: contact.id }, data: { projects: { push: tagged } } });
  }
  console.log(`[whatsapp] inbound ${m.type} from ${maskNumber(m.from)}${tagged ? " -> " + tagged : ""}`);

  // Media copy runs in the background so Meta gets its 200 quickly.
  if (m.mediaId) void storeMedia(msg.id, conv.id, m.mediaId, m.mediaMime, m.filename);

  if (waConfigured()) {
    try {
      if (keyword === "stop") {
        await recordOutbound(conv.id, "text", "You're unsubscribed from The Hearth and Hollow WhatsApp messages. Reply START to opt back in.", "auto",
          (t) => sendText(m.from, t));
      } else if (keyword === "start") {
        await recordOutbound(conv.id, "text", "You're subscribed again. Reply STOP anytime to opt out.", "auto", (t) => sendText(m.from, t));
      } else if (menuChoice) {
        await recordOutbound(conv.id, "text", `Thanks! We've noted this is about ${PROJECT_LABELS[menuChoice]}. Hunter will reply here soon.`, "auto",
          (t) => sendText(m.from, t));
      } else if (!conv.project && !conv.menuSentAt) {
        await prisma.waConversation.update({ where: { id: conv.id }, data: { menuSentAt: new Date() } });
        await recordOutbound(conv.id, "interactive", "[Menu] What can we help with?", "auto", () => sendProjectMenu(m.from));
      }
    } catch (e) {
      console.error("[whatsapp] auto-reply failed:", e instanceof Error ? e.message : e);
    }
  }
  await maybeAlert(conv.id);
  return true;
}

async function handleStatus(s: StatusUpdate) {
  const msg = await prisma.waMessage.findUnique({ where: { wamid: s.wamid } });
  if (!msg) return;
  await prisma.waMessage.update({
    where: { id: msg.id },
    data: {
      status: nextStatus(msg.status, s.status),
      ...(s.status === "failed" ? { errorCode: s.errorCode, errorTitle: s.errorTitle } : {}),
    },
  });
}

async function storeMedia(messageId: string, conversationId: string, mediaId: string, mime: string | null, filename: string | null) {
  try {
    const { bytes, mime: realMime } = await downloadMedia(mediaId);
    if (bytes.byteLength > MAX_MEDIA_BYTES) throw new Error("media too large");
    const ext = (filename && filename.includes(".") ? filename.split(".").pop() : (realMime || mime || "").split("/")[1]) || "bin";
    const key = `whatsapp/${conversationId}/${messageId}.${ext.replace(/[^a-z0-9]/gi, "").slice(0, 8)}`;
    await putPrivateObject(key, bytes, realMime || mime || "application/octet-stream");
    await prisma.waMessage.update({ where: { id: messageId }, data: { mediaKey: key, mediaMime: realMime || mime, mediaId: null } });
  } catch (e) {
    console.error("[whatsapp] media store failed:", e instanceof Error ? e.message : e);
  }
}

// Send + log in one place. `send` returns the wamid; on failure the message is logged as failed.
export async function recordOutbound(
  conversationId: string, type: string, body: string, sentBy: string,
  send: (body: string) => Promise<string>, templateName?: string,
): Promise<{ ok: boolean; id: string; error?: string }> {
  const row = await prisma.waMessage.create({
    data: { conversationId, direction: "out", type, body, status: "queued", sentBy, templateName: templateName || null },
  });
  try {
    const wamid = await send(body);
    await prisma.waMessage.update({ where: { id: row.id }, data: { wamid, status: "sent" } });
    await prisma.waConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
    return { ok: true, id: row.id };
  } catch (e: any) {
    await prisma.waMessage.update({
      where: { id: row.id },
      data: { status: "failed", errorCode: typeof e?.code === "number" ? e.code : null, errorTitle: String(e?.message || e).slice(0, 300) },
    });
    return { ok: false, id: row.id, error: String(e?.message || e) };
  }
}

// Find or open a conversation for a number (used by the internal send API).
export async function conversationFor(waId: string, project: Project | null) {
  const contact = await prisma.waContact.upsert({ where: { waId }, create: { waId }, update: {} });
  let conv = await prisma.waConversation.findFirst({ where: { contactId: contact.id, status: "open" }, orderBy: { lastMessageAt: "desc" } });
  if (!conv) conv = await prisma.waConversation.create({ data: { contactId: contact.id, project } });
  else if (!conv.project && project) conv = await prisma.waConversation.update({ where: { id: conv.id }, data: { project } });
  if (project && !contact.projects.includes(project)) {
    await prisma.waContact.update({ where: { id: contact.id }, data: { projects: { push: project } } });
  }
  return { contact: await prisma.waContact.findUniqueOrThrow({ where: { id: contact.id } }), conv };
}
