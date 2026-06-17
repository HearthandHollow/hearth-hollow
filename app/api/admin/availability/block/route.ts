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
 * Close off or reopen specific dates.
 * Body: { dates: string[] ("YYYY-MM-DD"), blocked: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { dates, blocked } = await req.json().catch(() => ({} as any));
    if (!Array.isArray(dates) || typeof blocked !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const parsed = dates
      .map((d) => parseDateKey(String(d)))
      .filter((d): d is Date => d !== null);

    if (blocked) {
      // Add blocked dates (ignore duplicates via unique constraint).
      for (const date of parsed) {
        await prisma.blockedDate.upsert({
          where: { date },
          create: { date },
          update: {},
        });
      }
    } else {
      await prisma.blockedDate.deleteMany({
        where: { date: { in: parsed } },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/availability/block]', error);
    return NextResponse.json({ error: 'Failed to update dates' }, { status: 500 });
  }
}
