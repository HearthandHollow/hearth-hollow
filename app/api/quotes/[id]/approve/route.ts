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
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3001'
      return NextResponse.redirect(`${baseUrl}/request?error=Quote not found`)
    }

    // Verify email matches
    if (project.customer.email !== email) {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3001'
      return NextResponse.redirect(`${baseUrl}/request?error=Unauthorized`)
    }

    // Update approval status
    await prisma.projectRequest.update({
      where: { id: params.id },
      data: {
        approvalStatus: 'active',
        clientApprovedAt: new Date(),
        clientDeniedAt: null,
        status: 'accepted',
        updatedAt: new Date(),
      },
    })

    // Redirect to approval confirmation page
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3001'
    return NextResponse.redirect(`${baseUrl}/quote-approval/${params.id}?approved=true`)
  } catch (error) {
    console.error('Error approving quote:', error)
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3001'
    return NextResponse.redirect(`${baseUrl}/request?error=Failed to approve quote`)
  }
}
