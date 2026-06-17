import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getAvailabilitySettings,
  getBlockedDateKeys,
  getBookedDates,
} from '@/lib/availability';

export const dynamic = 'force-dynamic';

async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get('admin_session')?.value);
}

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const settings = await getAvailabilitySettings();
    const [blockedDates, bookedDates] = await Promise.all([
      getBlockedDateKeys(),
      getBookedDates(),
    ]);
    return NextResponse.json({ ...settings, blockedDates, bookedDates });
  } catch (error) {
    console.error('[admin/availability] GET', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const body = await req.json().catch(() => ({} as any));
    const settings = await getAvailabilitySettings();

    const data: any = {};
    for (const day of WEEKDAYS) {
      if (typeof body[day] === 'boolean') data[day] = body[day];
    }
    if (
      Number.isInteger(body.bookingWindowWeeks) &&
      body.bookingWindowWeeks > 0 &&
      body.bookingWindowWeeks <= 52
    ) {
      data.bookingWindowWeeks = body.bookingWindowWeeks;
    }

    const updated = await prisma.availabilitySettings.update({
      where: { id: settings.id },
      data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[admin/availability] PATCH', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
