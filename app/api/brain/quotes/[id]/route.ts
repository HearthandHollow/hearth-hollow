import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { brainAuthError, BRAIN_IMAGE_TYPES } from "@/lib/brain-auth";
import { buildEstimatorPrompt, brainDraftInstructions } from "@/lib/estimator-prompt";

export const dynamic = "force-dynamic";

// GET /api/brain/quotes/:id — one request for Brain to estimate: job details,
// photo list (bytes via ./photos/:assetId), and the SAME estimator prompt the
// API path uses, plus the Brain draft instructions. No customer contact info.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = brainAuthError(req);
  if (denied) return denied;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  const q = await prisma.projectRequest.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      category: true,
      timeline: true,
      description: true,
      createdAt: true,
      analysisState: true,
      uploadedAssets: { select: { id: true, filename: true, mimeType: true, fileSize: true } },
      estimate: { select: { source: true, sentAt: true, status: true } },
    },
  });
  if (!q) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const photos = q.uploadedAssets
    .filter((a) => BRAIN_IMAGE_TYPES.has(a.mimeType))
    .map((a) => ({ id: a.id, mimeType: a.mimeType, bytes: a.fileSize, path: `/api/brain/quotes/${q.id}/photos/${a.id}` }));
  const photoNote = photos.length
    ? `\n\nThe customer attached ${photos.length} photo(s) of the project, included above. Use them to inform your estimate (assess condition, scope, materials, and complexity from what you can see).`
    : "";

  return NextResponse.json({
    id: q.id,
    category: q.category,
    timeline: q.timeline,
    description: q.description,
    createdAt: q.createdAt,
    analysisState: q.analysisState,
    alreadySent: !!q.estimate?.sentAt,
    photos,
    otherFiles: q.uploadedAssets.length - photos.length,
    estimatorPrompt: buildEstimatorPrompt(q, photoNote),
    brainInstructions: brainDraftInstructions(q),
  });
}
