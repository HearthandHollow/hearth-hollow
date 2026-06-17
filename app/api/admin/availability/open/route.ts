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

/**
 * One-off open / un-open of specific dates (overrides a normally-off weekday).
 * Body: { dates: string[] ("YYYY-MM-DD"), open: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { dates, open } = await req.json().catch(() => ({} as any));
    if (!Array.isArray(dates) || typeof open !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const parsed = dates
      .map((d) => parseDateKey(String(d)))
      .filter((d): d is Date => d !== null);

    if (open) {
      for (const date of parsed) {
        await prisma.openDate.upsert({
          where: { date },
          create: { date },
          update: {},
        });
        // Opening a day cancels any existing block on it.
        await prisma.blockedDate.deleteMany({ where: { date } });
      }
    } else {
      await prisma.openDate.deleteMany({ where: { date: { in: parsed } } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/availability/open]', error);
    return NextResponse.json({ error: 'Failed to update dates' }, { status: 500 });
  }
}
