import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { email } = await request.json()

    // Find and update the project request
    const project = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: { customer: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Verify email matches
    if (project.customer.email !== email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update approval status
    const updated = await prisma.projectRequest.update({
      where: { id: params.id },
      data: {
        approvalStatus: 'denied',
        clientDeniedAt: new Date(),
        clientApprovedAt: null,
        status: 'declined',
        updatedAt: new Date(),
      },
      include: { customer: true, estimate: true },
    })

    return NextResponse.json({
      message: 'Quote declined successfully',
      project: updated,
    })
  } catch (error) {
    console.error('Error denying quote:', error)
    return NextResponse.json(
      { error: 'Failed to deny quote' },
      { status: 500 }
    )
  }
}
