import { NextRequest, NextResponse } from "next/server";
import { projectForToken, normalizeWaId, isProject, maskNumber } from "@/lib/whatsapp/core";
import { sendTemplate, waConfigured } from "@/lib/whatsapp/graph";
import { conversationFor, recordOutbound } from "@/lib/whatsapp/store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/comms/whatsapp/send — internal API for Hearth & Hollow projects (RackerTracker,
// quotes, farm sales...). Bearer token per project (COMMS_API_TOKENS="RACKERTRACKER:<tok>,...").
// Sends an APPROVED template only (free-form text is admin-inbox only).
// Body: { project?, to, template_name, language?, variables?: string[], opt_in?: { source } }
//   opt_in: the caller attests the user ticked a WhatsApp opt-in box (e.g. RackerTracker signup).
export async function POST(req: NextRequest) {
  const tokenProject = projectForToken(req.headers.get("authorization"), process.env.COMMS_API_TOKENS);
  if (!tokenProject) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!waConfigured()) return NextResponse.json({ error: "WhatsApp not configured" }, { status: 503 });

  const b = await req.json().catch(() => null) as any;
  const to = normalizeWaId(b?.to);
  const template = typeof b?.template_name === "string" ? b.template_name.trim() : "";
  const language = typeof b?.language === "string" && b.language ? b.language : "en_US";
  const variables: string[] = Array.isArray(b?.variables) ? b.variables.map((v: unknown) => String(v ?? "")).slice(0, 20) : [];
  // A token is scoped to its own project; it can't send as another one.
  const project = b?.project ? String(b.project).toUpperCase() : tokenProject;
  if (!isProject(project) || project !== tokenProject) return NextResponse.json({ error: "project not allowed for this token" }, { status: 403 });
  if (!to || !/^[a-z0-9_]{1,512}$/.test(template)) return NextResponse.json({ error: "to and template_name are required" }, { status: 400 });

  const { contact, conv } = await conversationFor(to, project);
  if (b?.opt_in && !contact.optedOutAt) {
    await prisma.waContact.update({
      where: { id: contact.id },
      data: { optedIn: true, optedInAt: contact.optedInAt || new Date(), optInSource: contact.optInSource || String(b.opt_in.source || project.toLowerCase()) },
    });
  } else if (!contact.optedIn) {
    // WhatsApp policy: only message people who opted in. STOP always wins.
    return NextResponse.json({ error: contact.optedOutAt ? "recipient opted out" : "recipient has not opted in" }, { status: 409 });
  }
  if (contact.optedOutAt && !contact.optedIn) return NextResponse.json({ error: "recipient opted out" }, { status: 409 });

  const summary = `[${template}] ${variables.join(" | ")}`.slice(0, 1000);
  const r = await recordOutbound(conv.id, "template", summary, `api:${project}`, () => sendTemplate(to, template, language, variables), template);
  console.log(`[comms] ${project} template ${template} to ${maskNumber(to)}: ${r.ok ? "sent" : "failed"}`);
  return r.ok
    ? NextResponse.json({ ok: true, message_id: r.id })
    : NextResponse.json({ ok: false, message_id: r.id, error: r.error }, { status: 502 });
}
