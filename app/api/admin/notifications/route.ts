import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/notifications — recent notifications + unread count.
// Query params: ?limit=20 (default 20, max 50)
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value
    if (!verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limitParam = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10)
    const limit = Math.min(Math.max(limitParam || 20, 1), 50)

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where: { viewedAt: null } }),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// POST /api/admin/notifications — mark notification(s) as viewed.
// Body: { id: string } to mark one, or { all: true } to mark all unread.
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value
    if (!verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({} as any))

    if (body?.all) {
      await prisma.notification.updateMany({
        where: { viewedAt: null },
        data: { viewedAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

    if (typeof body?.id === 'string') {
      await prisma.notification.update({
        where: { id: body.id },
        data: { viewedAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Provide id or all' }, { status: 400 })
  } catch (error) {
    console.error('Error updating notifications:', error)
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}
