import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ApprovalStatus = 'awaiting_analysis' | 'awaiting_client_approval' | 'active' | 'denied'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value
    if (!verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { quoteIds, status } = await req.json()

    if (!Array.isArray(quoteIds) || quoteIds.length === 0) {
      return NextResponse.json({ error: 'Invalid quote IDs' }, { status: 400 })
    }

    const validStatuses = ['awaiting_analysis', 'awaiting_client_approval', 'active', 'denied']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid approval status' }, { status: 400 })
    }

    // Update approval status for all quotes
    const result = await prisma.projectRequest.updateMany({
      where: {
        id: {
          in: quoteIds,
        },
      },
      data: {
        approvalStatus: status as ApprovalStatus,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: `Moved ${result.count} quote(s) to ${status}`,
      movedCount: result.count,
    })
  } catch (error) {
    console.error('Error moving quotes:', error)
    return NextResponse.json(
      { error: 'Failed to move quotes' },
      { status: 500 }
    )
  }
}
