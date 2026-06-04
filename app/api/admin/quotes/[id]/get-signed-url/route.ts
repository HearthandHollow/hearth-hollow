import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSignedUrlForKey } from '@/lib/s3';

async function isAuthenticated(req: NextRequest) {
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value === 'authenticated';
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!await isAuthenticated(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { s3Key } = body;

    if (!s3Key) {
      return NextResponse.json({ error: 'S3 key required' }, { status: 400 });
    }

    const signedUrl = await getSignedUrlForKey(s3Key);
    return NextResponse.json({ signedUrl });
  } catch (error) {
    console.error('[S3-SIGN]', 'Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}
