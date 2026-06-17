import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findThreadByReference, isGmailConfigured } from '@/lib/gmail';
import { analyzeEmailThread } from '@/lib/email-analyzer';

export const dynamic = 'force-dynamic';

async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get('admin_session')?.value);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isGmailConfigured()) {
      return NextResponse.json({ error: 'Gmail is not configured' }, { status: 503 });
    }
    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const quote = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: { estimate: true },
    });
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const thread = await findThreadByReference(params.id);
    if (!thread || thread.messages.length === 0) {
      return NextResponse.json(
        { error: 'No conversation found to analyze' },
        { status: 404 }
      );
    }

    const analysis = await analyzeEmailThread(
      {
        category: quote.category,
        description: quote.description,
        estimate: quote.estimate
          ? {
              lowEstimate: quote.estimate.lowEstimate,
              expectedEstimate: quote.estimate.expectedEstimate,
              highEstimate: quote.estimate.highEstimate,
            }
          : null,
      },
      thread.messages
    );

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[emails/analyze] error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze conversation' },
      { status: 500 }
    );
  }
}
