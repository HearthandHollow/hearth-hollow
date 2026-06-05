import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sendEstimateEmail } from '@/lib/email';

async function isAuthenticated(req: NextRequest) {
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value === 'authenticated';
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!await isAuthenticated(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const quote = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        estimate: true,
      },
    });

    if (!quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    if (!quote.estimate) {
      return NextResponse.json(
        { error: 'No estimate generated' },
        { status: 400 }
      );
    }

    console.log(`Sending estimate for quote ${params.id} to ${quote.customer?.email}`);

    // Build estimate details HTML
    const estimateHtml = `
      <h3>Estimate Range</h3>
      <ul>
        <li><strong>Low Estimate:</strong> $${quote.estimate.lowEstimate.toLocaleString()}</li>
        <li><strong>Expected Cost:</strong> $${quote.estimate.expectedEstimate.toLocaleString()}</li>
        <li><strong>High Estimate:</strong> $${quote.estimate.highEstimate.toLocaleString()}</li>
      </ul>

      ${quote.estimate.timeEstimation ? `<h3>Timeline</h3><p>${quote.estimate.timeEstimation}</p>` : ''}

      ${quote.estimate.materialRequirements ? `<h3>Materials</h3><p>${quote.estimate.materialRequirements}</p>` : ''}

      <h3>Breakdown</h3>
      <pre>${quote.estimate.breakdown}</pre>
    `;

    let emailSent = false;
    let emailError: string | null = null;

    try {
      await sendEstimateEmail(
        quote.customer?.email || '',
        quote.customer?.name || 'Valued Customer',
        quote.id,
        estimateHtml,
        undefined,
        true // Include action buttons
      );
      emailSent = true;
    } catch (resendError) {
      console.error('Email sending error:', resendError);
      emailError = resendError instanceof Error ? resendError.message : String(resendError);
    }

    // Update status and approval status
    const updated = await prisma.projectRequest.update({
      where: { id: params.id },
      data: {
        status: 'sent',
        approvalStatus: 'awaiting_client_approval',
        emailSentAt: new Date(),
      },
      include: {
        customer: true,
        estimate: true,
      },
    });

    // Return success even if email failed
    if (emailSent) {
      console.log(`Email sent successfully for quote ${params.id}`);
      return NextResponse.json(updated);
    } else {
      console.warn(`Email failed for quote ${params.id}: ${emailError}`);
      return NextResponse.json(
        {
          ...updated,
          warning: `Quote marked as sent, but email delivery may have failed: ${emailError}`
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error sending estimate:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send estimate',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
