import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProject, windowOpen } from "@/lib/whatsapp/core";

export const dynamic = "force-dynamic";

// GET /api/admin/whatsapp/conversations?project=HANDYMAN|UNTAGGED&status=open|closed|all
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const project = p.get("project");
  const status = p.get("status") || "open";
  const where: any = {};
  if (status !== "all") where.status = status === "closed" ? "closed" : "open";
  if (project === "UNTAGGED") where.project = null;
  else if (isProject(project)) where.project = project;

  const rows = await prisma.waConversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    include: {
      contact: { select: { id: true, waId: true, profileName: true, optedIn: true, optedOutAt: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, type: true, direction: true, createdAt: true } },
    },
  });
  const counts = await prisma.waConversation.groupBy({ by: ["project"], where: { status: "open" }, _sum: { unreadCount: true }, _count: true });
  return NextResponse.json({
    conversations: rows.map((c) => ({
      id: c.id, project: c.project, status: c.status, unreadCount: c.unreadCount,
      lastMessageAt: c.lastMessageAt, windowOpen: windowOpen(c.lastInboundAt),
      contact: c.contact, last: c.messages[0] || null,
    })),
    counts: counts.map((r) => ({ project: r.project, open: r._count, unread: r._sum.unreadCount || 0 })),
  });
}
