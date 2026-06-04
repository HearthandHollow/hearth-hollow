import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSignedUrlForKey } from '@/lib/s3';

async function isAuthenticated(req: NextRequest) {
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value === 'authenticated';
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!await isAuthenticated(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // The ID passed is actually the S3 key
    const s3Key = params.id;
    
    // Generate a signed URL for this key
    const signedUrl = await getSignedUrlForKey(s3Key);
    
    return NextResponse.json({ signedUrl });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}
