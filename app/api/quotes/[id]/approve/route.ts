import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyActionToken, createActionToken } from '@/lib/auth'
import { getBaseUrl } from '@/lib/site'
import { sendDepositRequestEmail } from '@/lib/email'

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
      include: { customer: true, estimate: true },
    })

    if (!project || !project.estimate) {
      return NextResponse.redirect(`${baseUrl}/request?error=Quote not found`)
    }

    await prisma.projectRequest.update({
      where: { id: params.id },
      data: {
        approvalStatus: project.estimate.depositAmount ? 'awaiting_deposit' : 'active',
        clientApprovedAt: new Date(),
        clientDeniedAt: null,
        status: 'accepted',
        updatedAt: new Date(),
      },
    })

    // If a deposit is required, send deposit email with checkout link
    if (project.estimate.depositAmount && project.estimate.depositAmount > 0) {
      // Get the checkout URL from our endpoint
      const checkoutResponse = await fetch(
        `${baseUrl}/api/quotes/${params.id}/deposit-checkout`,
        { method: 'POST' }
      )

      if (!checkoutResponse.ok) {
        console.error('Failed to create checkout session')
        return NextResponse.redirect(`${baseUrl}/request?error=Failed to process quote approval`)
      }

      const { checkoutUrl } = await checkoutResponse.json()

      // Send deposit request email
      await sendDepositRequestEmail(
        project.customer.email,
        project.customer.name,
        params.id,
        project.estimate.depositAmount,
        checkoutUrl
      )

      return NextResponse.redirect(
        `${baseUrl}/quote-approval/${params.id}?status=deposit_requested`
      )
    }

    // No deposit required, send to scheduling page
    const scheduleToken = createActionToken(`${params.id}:schedule`)
    return NextResponse.redirect(
      `${baseUrl}/schedule/${params.id}?token=${scheduleToken}`
    )
  } catch (error) {
    console.error('Error approving quote:', error)
    return NextResponse.redirect(`${baseUrl}/request?error=Failed to approve quote`)
  }
}
