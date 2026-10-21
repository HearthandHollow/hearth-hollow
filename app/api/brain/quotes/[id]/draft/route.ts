import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { brainAuthError } from "@/lib/brain-auth";
import { parseBrainDraft, brainBreakdown } from "@/lib/brain-draft";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// POST /api/brain/quotes/:id/draft — Brain writes its draft estimate. It lands as
// a "Draft — Brain" estimate (source=brain, reviewedAt=null); the send route
// refuses to email it until Hunter clicks "Approve draft". Nothing is sent here.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = brainAuthError(req);
  if (denied) return denied;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const parsed = parseBrainDraft(body?.draft ?? body);
  if (!parsed.ok) return NextResponse.json({ error: "Invalid draft", details: parsed.errors }, { status: 400 });
  const d = parsed.draft;
  const photosViewed = Math.max(0, Math.floor(Number(body?.photosViewed) || 0));

  const quote = await prisma.projectRequest.findUnique({
    where: { id: params.id },
    select: { id: true, category: true, description: true, estimate: { select: { sentAt: true } } },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (quote.estimate?.sentAt) {
    return NextResponse.json({ error: "An estimate was already sent for this request; not overwriting it." }, { status: 409 });
  }

  const data = {
    lowEstimate: d.lowEstimate,
    expectedEstimate: d.expectedEstimate,
    highEstimate: d.highEstimate,
    breakdown: brainBreakdown(quote, d, photosViewed),
    confidence: d.confidence,
    rawAnalysis: JSON.stringify({ source: "brain", photosViewed, ...d }, null, 2),
    materialList: d.materialList as any,
    timeEstimation: d.laborHours != null ? `~${d.laborHours} labor hours` : null,
    source: "brain",
    reviewedAt: null,
    isEdited: false,
  };
  await prisma.estimate.upsert({
    where: { projectId: quote.id },
    create: { projectId: quote.id, selectedTier: "expected", ...data },
    update: data,
  });
  await prisma.projectRequest.update({
    where: { id: quote.id },
    data: { analysisState: "draft_ready", status: "analyzed" },
  });
  await createNotification({
    type: "brain_draft",
    title: "Brain draft ready",
    message: `${quote.category} — review before sending`,
    url: `/admin/quotes/${quote.id}`,
  });
  return NextResponse.json({ ok: true, id: quote.id, analysisState: "draft_ready" });
}
