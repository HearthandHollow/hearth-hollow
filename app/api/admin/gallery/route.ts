import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadToS3 } from '@/lib/s3';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get('admin_session')?.value);
}

// Admin: upload a gallery image (multipart: file, caption?).
export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    let formData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    const caption = ((formData.get('caption') as string | null) || '').trim().slice(0, 300);

    if (!file || typeof file === 'string' || file.size === 0) {
      return NextResponse.json({ error: 'An image file is required' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Image must be 10 MB or smaller' }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const s3Key = await uploadToS3(buffer, file.name, file.type, 'gallery');

    const created = await prisma.galleryImage.create({
      data: { s3Key, caption: caption || null },
    });
    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    console.error('[admin/gallery] POST', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
