import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getBaseUrl } from '@/lib/site';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-06-24.dahlia',
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the quote
    const projectRequest = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: { estimate: true, customer: true },
    });

    if (!projectRequest || !projectRequest.estimate) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    const estimate = projectRequest.estimate;

    if (!estimate.depositAmount || estimate.depositAmount <= 0) {
      return NextResponse.json(
        { error: 'No deposit amount set for this quote' },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Deposit for ${projectRequest.category} project`,
              description: `Deposit for project request #${projectRequest.id.slice(0, 8)}`,
            },
            unit_amount: Math.round(estimate.depositAmount), // Stripe expects amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/schedule/${projectRequest.id}?deposit_paid=true`,
      cancel_url: `${baseUrl}/quote-approval/${projectRequest.id}`,
      customer_email: projectRequest.customer.email,
      metadata: {
        projectId: projectRequest.id,
        estimateId: estimate.id,
      },
    });

    // Save the session ID to the estimate
    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { depositStripeSessionId: session.id },
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Deposit checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
