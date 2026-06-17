import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findThreadByReference, sendReply, isGmailConfigured } from '@/lib/gmail';

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

    const { body } = await req.json().catch(() => ({} as any));
    if (typeof body !== 'string' || !body.trim()) {
      return NextResponse.json({ error: 'Reply body is required' }, { status: 400 });
    }

    const quote = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: { customer: true },
    });
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const thread = await findThreadByReference(params.id);
    if (!thread || thread.messages.length === 0) {
      return NextResponse.json(
        { error: 'No existing conversation to reply to' },
        { status: 404 }
      );
    }

    const last = thread.messages[thread.messages.length - 1];
    const references = thread.messages
      .map((m) => m.messageId)
      .filter(Boolean)
      .join(' ');

    await sendReply({
      threadId: thread.threadId,
      to: quote.customer.email,
      subject: last.subject || `Your Project Estimate - Reference #${params.id}`,
      bodyText: body.trim(),
      inReplyTo: last.messageId || undefined,
      references: references || undefined,
    });

    // Return the refreshed thread so the UI can show the sent reply.
    const updated = await findThreadByReference(params.id);
    return NextResponse.json({
      success: true,
      messages: updated?.messages ?? thread.messages,
      threadId: updated?.threadId ?? thread.threadId,
    });
  } catch (error) {
    console.error('[emails/reply] error:', error);
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }
}
