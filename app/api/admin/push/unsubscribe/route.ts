import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/push/unsubscribe — remove this device's Web Push
// subscription. Body: { endpoint: string }
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    if (!verifySessionToken(cookieStore.get('admin_session')?.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null as any)
    const endpoint = body?.endpoint
    if (typeof endpoint !== 'string') {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    }

    await prisma.pushSubscription.deleteMany({ where: { endpoint } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing push subscription:', error)
    return NextResponse.json(
      { error: 'Failed to remove subscription' },
      { status: 500 }
    )
  }
}
