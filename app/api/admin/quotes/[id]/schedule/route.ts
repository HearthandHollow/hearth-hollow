import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseDateKey } from '@/lib/availability';

export const dynamic = 'force-dynamic';

async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get('admin_session')?.value);
}

const INCLUDE = { customer: true, uploadedAssets: true, estimate: true } as const;

/**
 * Admin: set, change, or clear a quote's scheduled date.
 * Body: { date: "YYYY-MM-DD" | null, slot?: "morning" | "afternoon" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { date, slot } = await req.json().catch(() => ({} as any));

    // Clear the schedule.
    if (date === null) {
      const updated = await prisma.projectRequest.update({
        where: { id: params.id },
        data: { scheduledDate: null, scheduledSlot: null, scheduledAt: null },
        include: INCLUDE,
      });
      return NextResponse.json(updated);
    }

    if (typeof date !== 'string') {
      return NextResponse.json({ error: 'A date is required' }, { status: 400 });
    }
    const parsed = parseDateKey(date);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    const validSlot = slot === 'afternoon' ? 'afternoon' : 'morning';

    // Prevent double-booking: another quote already on that day.
    const clash = await prisma.projectRequest.findFirst({
      where: { scheduledDate: parsed, id: { not: params.id } },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: 'Another job is already scheduled on that date' },
        { status: 409 }
      );
    }

    const updated = await prisma.projectRequest.update({
      where: { id: params.id },
      data: { scheduledDate: parsed, scheduledSlot: validSlot, scheduledAt: new Date() },
      include: INCLUDE,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[admin/quotes/schedule]', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}
