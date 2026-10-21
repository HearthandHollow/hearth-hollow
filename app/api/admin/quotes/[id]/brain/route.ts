import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get("admin_session")?.value);
}

// POST /api/admin/quotes/:id/brain  { action: "queue" | "unqueue" | "approve" }
//   queue   — mark for a Brain draft. Triggers NOTHING: Brain only looks when
//             Hunter asks it ("Brain, analyze the next quote").
//   unqueue — take it back off the queue.
//   approve — Hunter reviewed the Brain draft; unlocks Send.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const quote = await prisma.projectRequest.findUnique({
    where: { id: params.id },
    select: { id: true, analysisState: true, estimate: { select: { source: true, sentAt: true } } },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  if (action === "queue") {
    if (quote.estimate?.sentAt) return NextResponse.json({ error: "Estimate already sent" }, { status: 409 });
    await prisma.projectRequest.update({
      where: { id: quote.id },
      data: { analysisState: "queued", analysisQueuedAt: new Date() },
    });
  } else if (action === "unqueue") {
    if (quote.analysisState !== "queued") return NextResponse.json({ error: "Not queued" }, { status: 409 });
    await prisma.projectRequest.update({
      where: { id: quote.id },
      data: { analysisState: "none", analysisQueuedAt: null },
    });
  } else if (action === "approve") {
    if (quote.estimate?.source !== "brain") return NextResponse.json({ error: "No Brain draft to approve" }, { status: 409 });
    await prisma.estimate.update({ where: { projectId: quote.id }, data: { reviewedAt: new Date() } });
    await prisma.projectRequest.update({ where: { id: quote.id }, data: { analysisState: "reviewed" } });
  } else {
    return NextResponse.json({ error: "action must be queue, unqueue or approve" }, { status: 400 });
  }

  const updated = await prisma.projectRequest.findUnique({
    where: { id: quote.id },
    include: { customer: true, uploadedAssets: true, estimate: true },
  });
  return NextResponse.json(updated);
}
