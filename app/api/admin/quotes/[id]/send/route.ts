import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

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
    console.log(`Resend API Key available: ${!!process.env.RESEND_API_KEY}`);
    console.log(`From email: ${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}`);

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

    let emailSent = false;
    let emailError: string | null = null;

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        // Always send to the customer email (not admin)
        const toEmail = quote.customer?.email;
        
        if (!toEmail) {
          throw new Error('No customer email available');
        }

        const result = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to: toEmail,
          subject: `Your Project Estimate - Reference #${quote.id}`,
          html: emailHtml,
        });
        
        console.log('Email send result:', result);
        emailSent = !result.error;
        if (result.error) {
          emailError = result.error.message;
        }
      } catch (resendError) {
        console.error('Resend error:', resendError);
        emailError = resendError instanceof Error ? resendError.message : String(resendError);
      }
    } else {
      console.warn('Resend API key not configured');
      emailError = 'Email service not configured';
    }

    // Update status regardless of email result
    const updated = await prisma.projectRequest.update({
      where: { id: params.id },
      data: { status: 'sent' },
      include: {
        customer: true,
        estimate: true,
      },
    });

    // Return success even if email failed (at least the quote is marked as sent)
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
