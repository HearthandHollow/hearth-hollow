import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { createActionToken } from '@/lib/auth';
import { getBaseUrl } from '@/lib/site';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};

      // --- Invoice payment ---
      if (metadata.type === 'invoice' && metadata.invoiceId) {
        try {
          const invoice = await prisma.invoice.update({
            where: { id: metadata.invoiceId },
            data: { status: 'paid', paidAt: new Date() },
            include: { project: { include: { customer: true } } },
          });
          const { createNotification } = await import('@/lib/notifications');
          await createNotification({
            type: 'booking',
            title: `Invoice ${invoice.invoiceNumber} paid`,
            message: `${invoice.project?.customer?.name || 'Customer'} paid $${invoice.total.toLocaleString()}.`,
            url: `/admin/quotes/${invoice.projectId}`,
          });
        } catch (e) {
          console.error('[webhook] invoice mark-paid failed:', e);
        }
        return NextResponse.json({ received: true });
      }

      // --- Client-business invoice payment (admin Clients hub) ---
      if (metadata.type === 'client_invoice' && metadata.clientInvoiceId) {
        try {
          const invoice = await prisma.clientInvoice.update({
            where: { id: metadata.clientInvoiceId },
            data: { status: 'paid', paidAt: new Date() },
            include: { client: true },
          });
          const { createNotification } = await import('@/lib/notifications');
          await createNotification({
            type: 'booking',
            title: `Client invoice ${invoice.invoiceNumber} paid`,
            message: `${invoice.client.businessName} paid $${invoice.total.toLocaleString()}.`,
            url: `/admin/clients/${invoice.clientId}`,
          });
        } catch (e) {
          console.error('[webhook] client-invoice mark-paid failed:', e);
        }
        return NextResponse.json({ received: true });
      }

      // --- Deposit payment (on quote approval) ---
      // Payment Links we create outside the app (e.g. the Carolina HealthCare
      // care-plan subscription and the one-time domain link) also fire
      // checkout.session.completed, but carry no projectId in their metadata.
      // Those events are not ours to process — acknowledge them with 200 so
      // Stripe stops retrying and doesn't disable the endpoint. Only the
      // signature checks above should ever return a non-2xx for a real event.
      if (!metadata.projectId) {
        console.log('[webhook] checkout.session.completed ignored — no projectId', {
          eventId: event.id,
          paymentLink: session.payment_link ?? null,
          metadata,
        });
        return NextResponse.json({ received: true, ignored: 'no projectId' });
      }

      const estimate = await prisma.estimate.findFirst({
        where: { project: { id: metadata.projectId } },
        include: { project: { include: { customer: true } } },
      });

      if (!estimate) {
        console.error(`Estimate not found for project ${metadata.projectId}`);
        return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
      }

      await prisma.estimate.update({
        where: { id: estimate.id },
        data: { depositPaid: true },
      });

      const baseUrl = getBaseUrl();
      const projectId = estimate.project.id;
      const scheduleToken = createActionToken(`${projectId}:schedule`);
      const scheduleUrl = `${baseUrl}/schedule/${projectId}?token=${scheduleToken}`;

      await prisma.projectRequest.update({
        where: { id: projectId },
        data: { approvalStatus: 'active' },
      });

      await sendCustomSchedulingEmail(
        estimate.project.customer.email,
        estimate.project.customer.name,
        projectId,
        scheduleUrl
      );

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
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
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
        <a href="${scheduleUrl}" style="background-color: #ea580c; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
          Schedule Your Project
        </a>
      </div>
      <p>Select your preferred date and time, and we'll get you on the calendar!</p>
      <p>Questions? Just reply to this email.</p>
      <p>Best regards,<br/>The Hearth &amp; Hollow Team</p>
    `,
    `Thank you for your deposit!\n\nHi ${customerName},\n\nWe've received your deposit payment. Now it's time to schedule your project!\n\nSchedule your project here: ${scheduleUrl}\n\nSelect your preferred date and time.\n\nQuestions? Just reply to this email.\n\nBest regards,\nThe Hearth & Hollow Team`
  );
}
