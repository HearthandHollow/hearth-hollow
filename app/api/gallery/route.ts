import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSignedUrlForKey } from '@/lib/s3';

export const dynamic = 'force-dynamic';

// Public: list gallery images (newest first) with signed URLs.
export async function GET() {
  try {
    if (!prisma) return NextResponse.json({ images: [] });
    const rows = await prisma.galleryImage.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const images = await Promise.all(
      rows.map(async (r) => {
        let url = '';
        try {
          url = await getSignedUrlForKey(r.s3Key);
        } catch {
          url = '';
        }
        return { id: r.id, caption: r.caption, url };
      })
    );
    return NextResponse.json({ images: images.filter((i) => i.url) });
  } catch (error) {
    console.error('[gallery] GET', error);
    return NextResponse.json({ error: 'Failed to load gallery' }, { status: 500 });
  }
}
