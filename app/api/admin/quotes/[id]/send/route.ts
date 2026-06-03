import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Send email with estimate
    const emailHtml = `
      <h2>Your Project Estimate</h2>
      <p>Hi ${quote.customer?.name},</p>
      <p>Thank you for choosing The Hearth & Hollow! Here's your project estimate:</p>
      
      <h3>Estimate Range</h3>
      <ul>
        <li><strong>Low Estimate:</strong> $${quote.estimate.lowEstimate.toLocaleString()}</li>
        <li><strong>Expected Cost:</strong> $${quote.estimate.expectedEstimate.toLocaleString()}</li>
        <li><strong>High Estimate:</strong> $${quote.estimate.highEstimate.toLocaleString()}</li>
      </ul>
      
      <h3>Breakdown</h3>
      <pre>${quote.estimate.breakdown}</pre>
      
      <p>Please reply to this email to discuss next steps or ask any questions!</p>
      <p>Best regards,<br/>The Hearth & Hollow Team</p>
    `;

    await resend.emails.send({
      from: 'estimates@thehearthhollow.com',
      to: quote.customer?.email || '',
      subject: `Your Project Estimate - Reference #${quote.id}`,
      html: emailHtml,
    });

    // Update status
    const updated = await prisma.projectRequest.update({
      where: { id: params.id },
      data: { status: 'sent' },
      include: {
        customer: true,
        estimate: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error sending estimate:', error);
    return NextResponse.json(
      { error: 'Failed to send estimate' },
      { status: 500 }
    );
  }
}
