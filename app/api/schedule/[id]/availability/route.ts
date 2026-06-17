import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyActionToken } from '@/lib/auth';
import { getAvailableDates } from '@/lib/availability';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const quote = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: { customer: true },
    });
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const dates = await getAvailableDates();

    return NextResponse.json({
      customerName: quote.customer?.name || '',
      alreadyBooked: quote.scheduledDate
        ? {
            date: quote.scheduledDate.toISOString().slice(0, 10),
            slot: quote.scheduledSlot,
          }
        : null,
      dates,
    });
  } catch (error) {
    console.error('[schedule/availability]', error);
    return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 });
  }
}
