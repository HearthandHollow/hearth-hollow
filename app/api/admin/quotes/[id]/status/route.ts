import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin session
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { approvalStatus } = body

    // Validate approval status
    const validStatuses = ['awaiting_analysis', 'awaiting_client_approval', 'active', 'denied']
    if (!validStatuses.includes(approvalStatus)) {
      return NextResponse.json(
        { error: 'Invalid approval status' },
        { status: 400 }
      )
    }

    // Update project request
    const updateData: any = {
      approvalStatus,
      updatedAt: new Date(),
    }

    // Set timestamps based on status change
    if (approvalStatus === 'active') {
      updateData.clientApprovedAt = new Date()
      updateData.clientDeniedAt = null
    } else if (approvalStatus === 'denied') {
      updateData.clientDeniedAt = new Date()
      updateData.clientApprovedAt = null
    }

    const project = await prisma.projectRequest.update({
      where: { id: params.id },
      data: updateData,
      include: {
        customer: true,
        estimate: true,
        uploadedAssets: true,
      },
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error updating status:', error)
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    )
  }
}
