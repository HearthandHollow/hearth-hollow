import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Find and update the project request
    const project = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: { customer: true },
    })

    if (!project) {
      return NextResponse.redirect(
        new URL('/request?error=Quote not found', request.url)
      )
    }

    // Verify email matches
    if (project.customer.email !== email) {
      return NextResponse.redirect(
        new URL('/request?error=Unauthorized', request.url)
      )
    }

    // Update approval status
    await prisma.projectRequest.update({
      where: { id: params.id },
      data: {
        approvalStatus: 'denied',
        clientDeniedAt: new Date(),
        clientApprovedAt: null,
        status: 'declined',
        updatedAt: new Date(),
      },
    })

    // Redirect to request page with message
    return NextResponse.redirect(
      new URL('/request?declined=true', request.url)
    )
  } catch (error) {
    console.error('Error denying quote:', error)
    return NextResponse.redirect(
      new URL('/request?error=Failed to decline quote', request.url)
    )
  }
}
