import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadToS3 } from '@/lib/s3';
import { isHeic, heicToJpeg } from '@/lib/image';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif']);

function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

// HEIC (and some other formats) often arrive with an empty/unknown MIME type
// from the browser, so derive one from the extension when needed.
function mimeForFile(file: File): string {
  if (file.type) return file.type;
  const ext = extOf(file.name);
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'application/octet-stream';
}

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

    let mimeType = mimeForFile(file);
    if (!ALLOWED.has(mimeType) && !ALLOWED_EXTENSIONS.has(extOf(file.name))) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || extOf(file.name) || 'unknown'}` }, { status: 400 });
    }

    let buffer: ArrayBuffer | Buffer = await file.arrayBuffer();
    let filename = file.name;

    // Convert HEIC/HEIF to JPEG so it previews in the browser. Falls back to
    // the original on any conversion failure.
    if (isHeic(mimeType, filename)) {
      try {
        buffer = await heicToJpeg(Buffer.from(buffer));
        filename = filename.replace(/\.(heic|heif)$/i, '') + '.jpg';
        mimeType = 'image/jpeg';
      } catch (convErr) {
        console.error(`[HEIC] gallery conversion failed for ${file.name}, keeping original:`, convErr);
      }
    }

    const s3Key = await uploadToS3(buffer, filename, mimeType, 'gallery');

    const created = await prisma.galleryImage.create({
      data: { s3Key, caption: caption || null },
    });
    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    console.error('[admin/gallery] POST', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
