import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { windowOpen } from "@/lib/whatsapp/core";
import { sendText, sendTemplate, waConfigured } from "@/lib/whatsapp/graph";
import { recordOutbound } from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

// POST { text } inside the 24h window, or { template_name, language?, variables? } any time.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!waConfigured()) return NextResponse.json({ error: "WhatsApp not configured" }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as any;
  const c = await prisma.waConversation.findUnique({ where: { id: params.id }, include: { contact: true } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.contact.optedOutAt && !c.contact.optedIn) return NextResponse.json({ error: "This contact opted out (sent STOP)." }, { status: 409 });
  const to = c.contact.waId;

  let r;
  if (typeof b.text === "string" && b.text.trim()) {
    if (!windowOpen(c.lastInboundAt)) {
      return NextResponse.json({ error: "The 24-hour reply window is closed. Send an approved template instead." }, { status: 409 });
    }
    const text = b.text.trim().slice(0, 4096);
    r = await recordOutbound(c.id, "text", text, "admin", (t) => sendText(to, t));
  } else if (typeof b.template_name === "string" && /^[a-z0-9_]{1,512}$/.test(b.template_name)) {
    const vars: string[] = Array.isArray(b.variables) ? b.variables.map((v: unknown) => String(v ?? "")) : [];
    r = await recordOutbound(c.id, "template", `[${b.template_name}] ${vars.join(" | ")}`, "admin",
      () => sendTemplate(to, b.template_name, b.language || "en_US", vars), b.template_name);
  } else {
    return NextResponse.json({ error: "text or template_name required" }, { status: 400 });
  }
  if (c.status === "closed") await prisma.waConversation.update({ where: { id: c.id }, data: { status: "open" } });
  return r.ok ? NextResponse.json({ ok: true, id: r.id }) : NextResponse.json({ ok: false, id: r.id, error: r.error }, { status: 502 });
}
