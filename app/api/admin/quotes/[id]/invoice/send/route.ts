import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import { sendInvoiceEmail } from '@/lib/email';
import { getBaseUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get('admin_session')?.value);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { projectId: params.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'No invoice found for this quote' }, { status: 404 });
    }

    const project = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: { customer: true },
    });
    if (!project || !project.customer?.email) {
      return NextResponse.json({ error: 'Quote or customer email not found' }, { status: 404 });
    }

    // Create a Stripe checkout link so the customer can pay the invoice online.
    // Best-effort: if Stripe isn't configured or the call fails, still send the PDF.
    let payUrl: string | undefined;
    if (process.env.STRIPE_SECRET_KEY && invoice.status !== 'paid' && invoice.total > 0) {
      try {
        const baseUrl = getBaseUrl();
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Invoice ${invoice.invoiceNumber}`,
                  description: `Payment for ${project.category} project`,
                },
                unit_amount: Math.round(invoice.total * 100),
              },
              quantity: 1,
            },
          ],
          customer_email: project.customer.email,
          success_url: `${baseUrl}/?invoice=${invoice.invoiceNumber}&paid=1`,
          cancel_url: `${baseUrl}/`,
          metadata: {
            type: 'invoice',
            invoiceId: invoice.id,
            projectId: project.id,
            invoiceNumber: invoice.invoiceNumber,
          },
        });
        payUrl = session.url ?? undefined;
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { stripeSessionId: session.id },
        });
      } catch (e) {
        console.error('[invoice/send] Stripe checkout creation failed:', e);
      }
    }

    const pdfBuffer = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      createdAt: invoice.createdAt,
      customerName: project.customer.name || 'Customer',
      customerEmail: project.customer.email,
      customerPhone: project.customer.phone,
      projectId: project.id,
      category: project.category,
      location: project.location,
      lineItems: invoice.lineItems as any,
      subtotal: invoice.subtotal,
      total: invoice.total,
      notes: invoice.notes || undefined,
    });

    await sendInvoiceEmail(
      project.customer.email,
      project.customer.name || 'Valued Customer',
      project.id,
      invoice.invoiceNumber,
      invoice.total,
      pdfBuffer,
      payUrl
    );

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'sent', sentAt: new Date() },
    });

    return NextResponse.json({ invoice: updated, payUrl: payUrl ?? null });
  } catch (error) {
    console.error('[admin/quotes/invoice/send]', error);
    return NextResponse.json(
      { error: 'Failed to send invoice', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
