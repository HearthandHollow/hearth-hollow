import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyActionToken } from '@/lib/auth';
import { isDateBookable, parseDateKey, SLOTS } from '@/lib/availability';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { createBookingEvent } from '@/lib/calendar';
import { sendAdminPush } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!verifyActionToken(`${params.id}:schedule`, token)) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 });
    }
    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { date, slot } = await req.json().catch(() => ({} as any));
    if (typeof date !== 'string' || !SLOTS.includes(slot)) {
      return NextResponse.json({ error: 'Please choose a date and time' }, { status: 400 });
    }
    const parsed = parseDateKey(date);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    if (!(await isDateBookable(date))) {
      return NextResponse.json(
        { error: 'Sorry, that date is no longer available. Please pick another.' },
        { status: 409 }
      );
    }

    const quote = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: { customer: true },
    });
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    await prisma.projectRequest.update({
      where: { id: params.id },
      data: {
        scheduledDate: parsed,
        scheduledSlot: slot,
        scheduledAt: new Date(),
      },
    });

    // Confirmation email (best-effort)
    try {
      await sendBookingConfirmationEmail(
        quote.customer.email,
        quote.customer.name,
        date,
        slot,
        params.id
      );
    } catch (e) {
      console.error('[schedule/book] email failed:', e);
    }

    // Calendar event (best-effort; no-op if calendar scope not granted)
    try {
      await createBookingEvent({
        date: parsed,
        slot,
        summary: `Job: ${quote.customer.name} — ${quote.category}`,
        description: `Project ${params.id}\n\n${quote.description}\n\nCustomer: ${quote.customer.name} (${quote.customer.email}, ${quote.customer.phone})\nLocation: ${quote.location || 'n/a'}`,
        attendeeEmail: quote.customer.email,
      });
    } catch (e) {
      console.error('[schedule/book] calendar failed:', e);
    }

    // Push notification to admin (best-effort)
    try {
      await sendAdminPush({
        title: 'Appointment scheduled',
        message: `${quote.customer.name} booked ${date} (${slot})`,
        url: `/admin/quotes/${params.id}`,
      });
    } catch (e) {
      console.error('[schedule/book] push failed:', e);
    }

    return NextResponse.json({ success: true, date, slot });
  } catch (error) {
    console.error('[schedule/book]', error);
    return NextResponse.json({ error: 'Failed to book your date' }, { status: 500 });
  }
}
