// WhatsApp Cloud API client (Graph API). Brain, 2026-10-21.
// WHATSAPP_GRAPH_BASE lets tests point at a local mock; production uses graph.facebook.com.
import { maskNumber, PROJECT_LABELS, MENU_ROW_PREFIX, PROJECTS } from "./core";

const VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
const base = () => (process.env.WHATSAPP_GRAPH_BASE || "https://graph.facebook.com").replace(/\/$/, "");

export function waConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function graph(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${base()}/${VERSION}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error || {};
    const err: any = new Error(e.message || `Graph API ${res.status}`);
    err.code = e.code; err.title = e.error_user_title || e.type; err.status = res.status;
    throw err;
  }
  return data;
}

async function sendMessage(to: string, body: Record<string, unknown>): Promise<string> {
  const data = await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...body }),
  });
  const wamid = data?.messages?.[0]?.id;
  if (!wamid) throw new Error("Graph API returned no message id");
  console.log(`[whatsapp] sent ${String(body.type)} to ${maskNumber(to)}`);
  return wamid;
}

export const sendText = (to: string, text: string) =>
  sendMessage(to, { type: "text", text: { body: text, preview_url: true } });

export const sendTemplate = (to: string, name: string, language: string, variables: string[] = []) =>
  sendMessage(to, {
    type: "template",
    template: {
      name,
      language: { code: language || "en_US" },
      ...(variables.length
        ? { components: [{ type: "body", parameters: variables.map((v) => ({ type: "text", text: String(v) })) }] }
        : {}),
    },
  });

// "What can we help with?" — rule-based menu, no AI (see brief constraints).
export const sendProjectMenu = (to: string) =>
  sendMessage(to, {
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "The Hearth and Hollow" },
      body: { text: "Thanks for reaching out! What can we help with? Pick one and we'll get back to you." },
      footer: { text: "Reply STOP anytime to opt out." },
      action: {
        button: "Choose a topic",
        sections: [{
          title: "Topics",
          rows: PROJECTS.filter((p) => p !== "CLIENT_SITES").map((p) => ({ id: MENU_ROW_PREFIX + p, title: PROJECT_LABELS[p] })),
        }],
      },
    },
  });

export async function markRead(wamid: string): Promise<void> {
  await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: wamid }),
  }).catch(() => {});
}

// Inbound media: GET /{media-id} -> short-lived URL -> download with the same bearer token.
export async function downloadMedia(mediaId: string): Promise<{ bytes: Buffer; mime: string }> {
  const meta = await graph(mediaId);
  if (!meta?.url) throw new Error("media url missing");
  const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } });
  if (!res.ok) throw new Error(`media download ${res.status}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), mime: meta.mime_type || res.headers.get("content-type") || "application/octet-stream" };
}

export async function listTemplates(): Promise<Array<{ name: string; language: string; status: string; category: string; body: string }>> {
  const waba = process.env.WHATSAPP_WABA_ID;
  if (!waba) return [];
  const data = await graph(`${waba}/message_templates?fields=name,language,status,category,components&limit=200`);
  return (data?.data || []).map((t: any) => ({
    name: t.name, language: t.language, status: t.status, category: t.category,
    body: (t.components || []).find((c: any) => c.type === "BODY")?.text || "",
  }));
}
