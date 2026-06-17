import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFromS3 } from '@/lib/s3';

export const dynamic = 'force-dynamic';

async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get('admin_session')?.value);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const image = await prisma.galleryImage.findUnique({ where: { id: params.id } });
    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.galleryImage.delete({ where: { id: params.id } });
    await deleteFromS3(image.s3Key); // best-effort cleanup

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/gallery] DELETE', error);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}
