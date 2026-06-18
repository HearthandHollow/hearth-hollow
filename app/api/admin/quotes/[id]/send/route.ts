import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEstimateEmail } from '@/lib/email';

async function isAuthenticated(req: NextRequest) {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get('admin_session')?.value);
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

    const tier = (quote.estimate.selectedTier as 'low' | 'expected' | 'high') || 'expected';
    const tierAmount =
      tier === 'low'
        ? quote.estimate.lowEstimate
        : tier === 'high'
        ? quote.estimate.highEstimate
        : quote.estimate.expectedEstimate;

    const materialList = Array.isArray(quote.estimate.materialList)
      ? (quote.estimate.materialList as any[])
      : [];

    const materialTableRows = materialList
      .map((m: any) => {
        const qty = Number(m?.quantity) || 0;
        const price = Number(m?.estimatedPrice) || 0;
        const lineTotal = qty * price;
        return `
          <tr>
            <td style="padding:4px 8px;border:1px solid #e5e7eb;">${m?.item || ''}</td>
            <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;">${qty} ${m?.unit || ''}</td>
            <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;">$${price.toFixed(2)}</td>
            <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;">$${lineTotal.toFixed(2)}</td>
          </tr>`;
      })
      .join('');

    const materialTableHtml = materialList.length
      ? `
        <h3>Estimated Materials</h3>
        <table style="border-collapse:collapse;width:100%;margin-bottom:1em;">
          <thead>
            <tr>
              <th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:left;">Item</th>
              <th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;">Qty</th>
              <th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;">Est. Price</th>
              <th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;">Line Total</th>
            </tr>
          </thead>
          <tbody>${materialTableRows}</tbody>
        </table>`
      : '';

    // Build estimate details HTML — show only the selected tier's price
    const estimateHtml = `
      <h3>Estimate</h3>
      <p style="font-size:1.25em;"><strong>$${tierAmount.toLocaleString()}</strong></p>

      ${quote.estimate.timeEstimation ? `<h3>Timeline</h3><p>${quote.estimate.timeEstimation}</p>` : ''}

      ${materialTableHtml}

      ${quote.estimate.materialRequirements ? `<h3>Additional Material Notes</h3><p>${quote.estimate.materialRequirements}</p>` : ''}

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
