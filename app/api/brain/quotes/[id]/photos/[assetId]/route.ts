import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectBytes } from "@/lib/s3";
import { brainAuthError, BRAIN_IMAGE_TYPES } from "@/lib/brain-auth";

export const dynamic = "force-dynamic";

// GET /api/brain/quotes/:id/photos/:assetId — raw image bytes for Brain to look
// at. Served through the app so Brain never needs S3 credentials or public URLs.
export async function GET(req: NextRequest, { params }: { params: { id: string; assetId: string } }) {
  const denied = brainAuthError(req);
  if (denied) return denied;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  const asset = await prisma.uploadedAsset.findFirst({
    where: { id: params.assetId, projectId: params.id },
    select: { s3Url: true, mimeType: true },
  });
  if (!asset || !BRAIN_IMAGE_TYPES.has(asset.mimeType)) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  try {
    const { buffer, contentType } = await getObjectBytes(asset.s3Url);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": BRAIN_IMAGE_TYPES.has(contentType) ? contentType : asset.mimeType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not load photo" }, { status: 502 });
  }
}
