import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyActionToken, createActionToken } from '@/lib/auth'
import { getBaseUrl } from '@/lib/site'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const baseUrl = getBaseUrl()
  try {
    const token = request.nextUrl.searchParams.get('token')

    // Authorize via the signed token embedded in the emailed link.
    if (!verifyActionToken(`${params.id}:approve`, token)) {
      return NextResponse.redirect(`${baseUrl}/request?error=Invalid or expired link`)
    }

    const project = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: { customer: true },
    })

    if (!project) {
      return NextResponse.redirect(`${baseUrl}/request?error=Quote not found`)
    }

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

    // Send the client to the scheduling page with a signed schedule token.
    const scheduleToken = createActionToken(`${params.id}:schedule`)
    return NextResponse.redirect(
      `${baseUrl}/schedule/${params.id}?token=${scheduleToken}`
    )
  } catch (error) {
    console.error('Error approving quote:', error)
    return NextResponse.redirect(`${baseUrl}/request?error=Failed to approve quote`)
  }
}
