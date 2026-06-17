import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin session
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value
    if (!verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      lowEstimate,
      expectedEstimate,
      highEstimate,
      breakdown,
      materialRequirements,
      timeEstimation,
    } = body

    // Update estimate
    const estimate = await prisma.estimate.update({
      where: { projectId: params.id },
      data: {
        lowEstimate: lowEstimate !== undefined ? parseFloat(lowEstimate) : undefined,
        expectedEstimate: expectedEstimate !== undefined ? parseFloat(expectedEstimate) : undefined,
        highEstimate: highEstimate !== undefined ? parseFloat(highEstimate) : undefined,
        breakdown: breakdown || undefined,
        materialRequirements: materialRequirements || undefined,
        timeEstimation: timeEstimation || undefined,
        isEdited: true,
        updatedAt: new Date(),
      },
      include: {
        project: {
          include: { customer: true },
        },
      },
    })

    return NextResponse.json(estimate)
  } catch (error) {
    console.error('Error updating estimate:', error)
    return NextResponse.json(
      { error: 'Failed to update estimate' },
      { status: 500 }
    )
  }
}
