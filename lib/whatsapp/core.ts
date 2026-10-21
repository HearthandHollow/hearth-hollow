// WhatsApp Comms Hub — pure helpers (no DB, no network) so they can be unit-tested
// (scripts/test-whatsapp.ts). Brain, 2026-10-21.
import { createHmac, timingSafeEqual } from "crypto";

export const PROJECTS = [
  "RACKERTRACKER",
  "HANDYMAN",
  "HOMESTEAD",
  "FABRICATION",
  "CLIENT_SITES",
  "GENERAL",
] as const;
export type Project = (typeof PROJECTS)[number];

export const PROJECT_LABELS: Record<Project, string> = {
  RACKERTRACKER: "RackerTracker",
  HANDYMAN: "Handyman quote",
  HOMESTEAD: "Farm & eggs",
  FABRICATION: "Welding & fab",
  CLIENT_SITES: "Client sites",
  GENERAL: "Something else",
};

export function isProject(v: unknown): v is Project {
  return typeof v === "string" && (PROJECTS as readonly string[]).includes(v);
}

// ── Signature (X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(rawBody, appSecret)) ──
export function verifySignature(rawBody: string, header: string | null | undefined, appSecret: string): boolean {
  if (!header || !appSecret || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const got = header.slice(7);
  if (got.length !== expected.length || !/^[0-9a-f]+$/i.test(got)) return false;
  return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
}

// ── Log hygiene: customer numbers never go to logs in full ──
export function maskNumber(n: string | null | undefined): string {
  const d = String(n || "").replace(/\D/g, "");
  return d.length <= 4 ? "****" : "…" + d.slice(-4);
}

// ── Project routing ──
// Deep links prefill a tag, e.g. wa.me/<number>?text=RT%3A%20 -> "RT: ..."
const PREFIXES: Array<[RegExp, Project]> = [
  [/^\s*(RT|RACKER(TRACKER)?)\s*[:\-]/i, "RACKERTRACKER"],
  [/^\s*(HH|HANDYMAN|QUOTE)\s*[:\-]/i, "HANDYMAN"],
  [/^\s*(FARM|EGGS?)\s*[:\-]/i, "HOMESTEAD"],
  [/^\s*(FAB|WELD(ING)?)\s*[:\-]/i, "FABRICATION"],
  [/^\s*(CS|SITE|CLIENT)\s*[:\-]/i, "CLIENT_SITES"],
];

export function projectFromText(text: string | null | undefined): Project | null {
  const t = String(text || "");
  for (const [re, p] of PREFIXES) if (re.test(t)) return p;
  return null;
}

// Interactive list row ids are "proj:<PROJECT>"
export const MENU_ROW_PREFIX = "proj:";
export function projectFromMenuReply(id: string | null | undefined): Project | null {
  const s = String(id || "");
  if (!s.startsWith(MENU_ROW_PREFIX)) return null;
  const p = s.slice(MENU_ROW_PREFIX.length);
  return isProject(p) ? p : null;
}

// Opt-out / opt-in keywords (WhatsApp policy: honour STOP)
export function optKeyword(text: string | null | undefined): "stop" | "start" | null {
  const t = String(text || "").trim().toUpperCase().replace(/[.!]+$/, "");
  if (["STOP", "UNSUBSCRIBE", "STOP ALL", "OPT OUT", "OPTOUT", "CANCEL"].includes(t)) return "stop";
  if (["START", "SUBSCRIBE", "OPT IN", "OPTIN", "UNSTOP"].includes(t)) return "start";
  return null;
}

// ── 24h customer-service window ──
export const WINDOW_MS = 24 * 60 * 60 * 1000;
export function windowOpen(lastInboundAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!lastInboundAt) return false;
  const t = new Date(lastInboundAt).getTime();
  return Number.isFinite(t) && now - t < WINDOW_MS;
}

// ── Webhook payload parsing ──
export interface InboundMessage {
  kind: "message";
  phoneNumberId: string;
  from: string; // wa_id
  profileName: string | null;
  wamid: string;
  timestamp: Date;
  type: string;
  text: string | null; // text body, caption, button/list title, etc.
  replyId: string | null; // interactive reply id (list/button)
  mediaId: string | null;
  mediaMime: string | null;
  filename: string | null;
}
export interface StatusUpdate {
  kind: "status";
  phoneNumberId: string;
  wamid: string;
  status: string; // sent | delivered | read | failed
  recipient: string;
  timestamp: Date;
  errorCode: number | null;
  errorTitle: string | null;
}
export type WaEvent = InboundMessage | StatusUpdate;

const MEDIA_TYPES = ["image", "audio", "video", "document", "sticker"];

export function parseWebhook(payload: any): WaEvent[] {
  const out: WaEvent[] = [];
  if (!payload || payload.object !== "whatsapp_business_account") return out;
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const v = change.value || {};
      const pnid = String(v.metadata?.phone_number_id || "");
      const names: Record<string, string> = {};
      for (const c of v.contacts || []) if (c.wa_id) names[c.wa_id] = c.profile?.name || null;
      for (const m of v.messages || []) {
        const type = String(m.type || "unsupported");
        let text: string | null = null;
        let replyId: string | null = null;
        let media: any = null;
        if (type === "text") text = m.text?.body ?? null;
        else if (type === "interactive") {
          const r = m.interactive?.list_reply || m.interactive?.button_reply || null;
          if (r) { text = r.title ?? null; replyId = r.id ?? null; }
        } else if (type === "button") { text = m.button?.text ?? null; replyId = m.button?.payload ?? null; }
        else if (MEDIA_TYPES.includes(type)) { media = m[type] || {}; text = media.caption ?? null; }
        else if (type === "location") text = [m.location?.name, m.location?.address, m.location ? `${m.location.latitude},${m.location.longitude}` : null].filter(Boolean).join(" — ");
        else if (type === "reaction") text = m.reaction?.emoji ?? null;
        else if (type === "contacts") text = (m.contacts || []).map((c: any) => c.name?.formatted_name).filter(Boolean).join(", ") || "Contact card";
        out.push({
          kind: "message",
          phoneNumberId: pnid,
          from: String(m.from || ""),
          profileName: names[m.from] ?? null,
          wamid: String(m.id || ""),
          timestamp: new Date(Number(m.timestamp || 0) * 1000 || Date.now()),
          type,
          text,
          replyId,
          mediaId: media?.id ?? null,
          mediaMime: media?.mime_type ?? null,
          filename: media?.filename ?? null,
        });
      }
      for (const s of v.statuses || []) {
        const err = (s.errors || [])[0] || null;
        out.push({
          kind: "status",
          phoneNumberId: pnid,
          wamid: String(s.id || ""),
          status: String(s.status || ""),
          recipient: String(s.recipient_id || ""),
          timestamp: new Date(Number(s.timestamp || 0) * 1000 || Date.now()),
          errorCode: err?.code ?? null,
          errorTitle: err?.title ?? err?.message ?? null,
        });
      }
    }
  }
  return out;
}

// Status updates can arrive out of order; never move backwards (read -> delivered).
const STATUS_RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
export function nextStatus(current: string | null | undefined, incoming: string): string {
  if (incoming === "failed") return "failed";
  return (STATUS_RANK[incoming] ?? -1) > (STATUS_RANK[current || ""] ?? -1) ? incoming : (current || incoming);
}

// ── Internal send API tokens: COMMS_API_TOKENS="RACKERTRACKER:tok1,HANDYMAN:tok2" ──
export function projectForToken(header: string | null | undefined, envValue: string | undefined): Project | null {
  const presented = (header || "").startsWith("Bearer ") ? (header as string).slice(7).trim() : "";
  if (presented.length < 24) return null;
  for (const pair of String(envValue || "").split(",")) {
    const i = pair.indexOf(":");
    if (i < 1) continue;
    const proj = pair.slice(0, i).trim().toUpperCase();
    const tok = pair.slice(i + 1).trim();
    if (!isProject(proj) || tok.length < 24 || tok.length !== presented.length) continue;
    if (timingSafeEqual(Buffer.from(tok), Buffer.from(presented))) return proj;
  }
  return null;
}

// E.164-ish validation for the send API ("+1 (555) 010-1234" -> "15550101234")
export function normalizeWaId(to: string | null | undefined): string | null {
  const d = String(to || "").replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? d : null;
}
