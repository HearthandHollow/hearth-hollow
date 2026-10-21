import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProject, windowOpen, WINDOW_MS } from "@/lib/whatsapp/core";
import { markRead, waConfigured } from "@/lib/whatsapp/graph";

export const dynamic = "force-dynamic";

// GET — thread (oldest first). Opening it marks the thread read (and sends blue ticks).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await prisma.waConversation.findUnique({
    where: { id: params.id },
    include: { contact: true, messages: { orderBy: { createdAt: "asc" }, take: 500 } },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.unreadCount > 0) {
    await prisma.waConversation.update({ where: { id: c.id }, data: { unreadCount: 0, alertedAt: null } });
    const lastIn = [...c.messages].reverse().find((m) => m.direction === "in" && m.wamid);
    if (lastIn?.wamid && waConfigured()) void markRead(lastIn.wamid);
  }
  return NextResponse.json({
    ...c,
    unreadCount: 0,
    windowOpen: windowOpen(c.lastInboundAt),
    windowClosesAt: c.lastInboundAt ? new Date(c.lastInboundAt.getTime() + WINDOW_MS) : null,
    messages: c.messages.map((m) => ({ ...m, mediaUrl: m.mediaKey ? `/api/admin/whatsapp/media/${m.id}` : null })),
  });
}

// PATCH — { project?: PROJECT|null, status?: "open"|"closed", optedIn?: boolean }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as any;
  const c = await prisma.waConversation.findUnique({ where: { id: params.id }, include: { contact: true } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data: any = {};
  if (b.project === null) data.project = null;
  else if (b.project !== undefined) {
    if (!isProject(b.project)) return NextResponse.json({ error: "bad project" }, { status: 400 });
    data.project = b.project;
    if (!c.contact.projects.includes(b.project)) await prisma.waContact.update({ where: { id: c.contactId }, data: { projects: { push: b.project } } });
  }
  if (b.status !== undefined) {
    if (!["open", "closed"].includes(b.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
    data.status = b.status;
  }
  if (typeof b.optedIn === "boolean") {
    await prisma.waContact.update({
      where: { id: c.contactId },
      data: b.optedIn ? { optedIn: true, optedInAt: new Date(), optedOutAt: null, optInSource: "admin" } : { optedIn: false, optedOutAt: new Date() },
    });
  }
  const updated = Object.keys(data).length ? await prisma.waConversation.update({ where: { id: c.id }, data }) : c;
  return NextResponse.json({ ok: true, id: updated.id, project: updated.project, status: updated.status });
}
