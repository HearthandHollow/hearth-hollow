import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/push/subscribe — save (or refresh) this device's Web Push
// subscription. Body is the raw browser PushSubscription JSON:
//   { endpoint: string, keys: { p256dh: string, auth: string } }
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    if (!verifySessionToken(cookieStore.get('admin_session')?.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null as any)
    const endpoint = body?.endpoint
    const p256dh = body?.keys?.p256dh
    const auth = body?.keys?.auth

    if (
      typeof endpoint !== 'string' ||
      typeof p256dh !== 'string' ||
      typeof auth !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid subscription payload' },
        { status: 400 }
      )
    }

    const userAgent = req.headers.get('user-agent') || undefined

    // Upsert by endpoint so re-subscribing the same device just refreshes its
    // keys instead of creating duplicate rows.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth, userAgent },
      create: { endpoint, p256dh, auth, userAgent },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving push subscription:', error)
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    )
  }
}
