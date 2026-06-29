import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { createActionToken } from '@/lib/auth';
import { getBaseUrl } from '@/lib/site';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      return NextResponse.json(
        { error: 'Missing signature or webhook secret' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const metadata = session.metadata;
      if (!metadata?.projectId) {
        console.error('Missing projectId in session metadata');
        return NextResponse.json(
          { error: 'Missing projectId' },
          { status: 400 }
        );
      }

      // Update the estimate to mark deposit as paid
      const estimate = await prisma.estimate.findFirst({
        where: {
          project: {
            id: metadata.projectId,
          },
        },
        include: {
          project: {
            include: {
              customer: true,
            },
          },
        },
      });

      if (!estimate) {
        console.error(`Estimate not found for project ${metadata.projectId}`);
        return NextResponse.json(
          { error: 'Estimate not found' },
          { status: 404 }
        );
      }

      // Mark deposit as paid
      await prisma.estimate.update({
        where: { id: estimate.id },
        data: { depositPaid: true },
      });

      // Send scheduling link email
      const baseUrl = getBaseUrl();
      const projectId = estimate.project.id;
      const scheduleToken = createActionToken(`${projectId}:schedule`);
      const scheduleUrl = `${baseUrl}/schedule/${projectId}?token=${scheduleToken}`;

      await prisma.projectRequest.update({
        where: { id: projectId },
        data: {
          approvalStatus: 'active', // Deposit paid, now they can schedule
        },
      });

      // Send the scheduling link email
      await sendCustomSchedulingEmail(
        estimate.project.customer.email,
        estimate.project.customer.name,
        projectId,
        scheduleUrl
      );

      // Notify admin
      const { createNotification: createNotif } = await import('@/lib/notifications');
      await createNotif({
        type: 'booking',
        title: `Deposit received for ${estimate.project.customer.name}`,
        message: `Deposit payment completed. Ready for scheduling.`,
        url: `/admin/quotes/${projectId}`,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function sendCustomSchedulingEmail(
  customerEmail: string,
  customerName: string,
  projectId: string,
  scheduleUrl: string
) {
  const { sendCustomEmail } = await import('@/lib/email');

  await sendCustomEmail(
    customerEmail,
    `Your deposit received — Schedule your project`,
    `
      <h2>Thank you for your deposit!</h2>
      <p>Hi ${customerName},</p>
      <p>We've received your deposit payment. Now it's time to schedule your project!</p>

      <div style="margin: 30px 0;">
        <a href="${scheduleUrl}"
           style="background-color: #ea580c; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
          Schedule Your Project
        </a>
      </div>

      <p>Select your preferred date and time, and we'll get you on the calendar!</p>
      <p>Questions? Just reply to this email.</p>

      <p>Best regards,<br/>The Hearth &amp; Hollow Team</p>
    `,
    `Thank you for your deposit!\n\nHi ${customerName},\n\nWe've received your deposit payment. Now it's time to schedule your project!\n\nSchedule your project here: ${scheduleUrl}\n\nSelect your preferred date and time, and we'll get you on the calendar!\n\nQuestions? Just reply to this email.\n\nBest regards,\nThe Hearth & Hollow Team`
  );
}

