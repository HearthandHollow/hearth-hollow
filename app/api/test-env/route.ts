import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Check what AWS env vars are set (don't expose values for security)
  const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
  const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
  const hasBucket = !!process.env.AWS_S3_BUCKET;
  const hasRegion = !!process.env.AWS_REGION;

  const status = {
    AWS_ACCESS_KEY_ID: hasAccessKey ? '✅ SET' : '❌ NOT SET',
    AWS_SECRET_ACCESS_KEY: hasSecretKey ? '✅ SET' : '❌ NOT SET',
    AWS_S3_BUCKET: hasBucket ? `✅ SET (${process.env.AWS_S3_BUCKET})` : '❌ NOT SET',
    AWS_REGION: hasRegion ? `✅ SET (${process.env.AWS_REGION})` : '❌ NOT SET (will use us-east-1)',
    
    DATABASE_URL: !!process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET',
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY ? '✅ SET' : '❌ NOT SET',
    RESEND_API_KEY: !!process.env.RESEND_API_KEY ? '✅ SET' : '❌ NOT SET',
  };

  return NextResponse.json({
    message: 'Environment variable status',
    status,
    s3Ready: hasAccessKey && hasSecretKey,
  });
}
