import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value
    if (!verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { quoteIds } = await req.json()

    if (!Array.isArray(quoteIds) || quoteIds.length === 0) {
      return NextResponse.json({ error: 'Invalid quote IDs' }, { status: 400 })
    }

    // Delete all quotes
    const result = await prisma.projectRequest.deleteMany({
      where: {
        id: {
          in: quoteIds,
        },
      },
    })

    return NextResponse.json({
      message: `Deleted ${result.count} quote(s)`,
      deletedCount: result.count,
    })
  } catch (error) {
    console.error('Error deleting quotes:', error)
    return NextResponse.json(
      { error: 'Failed to delete quotes' },
      { status: 500 }
    )
  }
}
