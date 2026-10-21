import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { brainAuthError, BRAIN_IMAGE_TYPES } from "@/lib/brain-auth";

export const dynamic = "force-dynamic";

// GET /api/brain/queue — requests Hunter queued for a Brain draft, oldest first.
// Deliberately no customer name/contact: Brain only needs the job.
export async function GET(req: NextRequest) {
  const denied = brainAuthError(req);
  if (denied) return denied;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  const rows = await prisma.projectRequest.findMany({
    where: { analysisState: "queued" },
    orderBy: [{ analysisQueuedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      category: true,
      timeline: true,
      createdAt: true,
      analysisQueuedAt: true,
      uploadedAssets: { select: { mimeType: true } },
    },
  });
  return NextResponse.json({
    queued: rows.map((r) => ({
      id: r.id,
      category: r.category,
      timeline: r.timeline,
      createdAt: r.createdAt,
      queuedAt: r.analysisQueuedAt,
      photos: r.uploadedAssets.filter((a) => BRAIN_IMAGE_TYPES.has(a.mimeType)).length,
    })),
  });
}
