import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import { sendInvoiceEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

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
      pdfBuffer
    );

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'sent', sentAt: new Date() },
    });

    return NextResponse.json({ invoice: updated });
  } catch (error) {
    console.error('[admin/quotes/invoice/send]', error);
    return NextResponse.json(
      { error: 'Failed to send invoice', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
