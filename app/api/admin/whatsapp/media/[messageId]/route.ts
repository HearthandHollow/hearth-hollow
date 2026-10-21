import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getObjectBytes } from "@/lib/s3";

export const dynamic = "force-dynamic";

// GET — stream a stored WhatsApp attachment to the logged-in admin (S3 object stays private).
export async function GET(_req: NextRequest, { params }: { params: { messageId: string } }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const m = await prisma.waMessage.findUnique({ where: { id: params.messageId }, select: { mediaKey: true, mediaMime: true } });
  if (!m?.mediaKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { buffer, contentType } = await getObjectBytes(m.mediaKey);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": m.mediaMime || contentType || "application/octet-stream", "Cache-Control": "private, max-age=3600" },
  });
}
