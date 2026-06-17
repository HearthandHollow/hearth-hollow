import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findThreadByReference, isGmailConfigured } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get('admin_session')?.value);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isGmailConfigured()) {
      return NextResponse.json(
        { configured: false, messages: [], threadId: null },
        { status: 200 }
      );
    }

    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const quote = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: { customer: true },
    });
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const thread = await findThreadByReference(params.id);
    return NextResponse.json({
      configured: true,
      threadId: thread?.threadId ?? null,
      messages: thread?.messages ?? [],
    });
  } catch (error) {
    console.error('[emails] error:', error);
    return NextResponse.json(
      { error: 'Failed to load conversation' },
      { status: 500 }
    );
  }
}
