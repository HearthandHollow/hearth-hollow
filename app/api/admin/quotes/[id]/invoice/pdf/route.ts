import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateInvoicePdf } from '@/lib/invoice-pdf';

export const dynamic = 'force-dynamic';

async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get('admin_session')?.value);
}

export async function GET(
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

    if (!project) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const pdfBuffer = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      createdAt: invoice.createdAt,
      customerName: project.customer?.name || 'Customer',
      customerEmail: project.customer?.email || '',
      customerPhone: project.customer?.phone,
      projectId: project.id,
      category: project.category,
      location: project.location,
      lineItems: invoice.lineItems as any,
      subtotal: invoice.subtotal,
      total: invoice.total,
      notes: invoice.notes || undefined,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[admin/quotes/invoice/pdf]', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
