import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get('admin_session')?.value);
}

function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${y}${m}${d}-${rand}`;
}

interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

function normalizeLineItems(raw: any[]): { description: string; quantity: number; unitPrice: number; total: number }[] {
  return (Array.isArray(raw) ? raw : [])
    .map((li: LineItemInput) => {
      const description = String(li?.description || '').trim();
      const quantity = Number(li?.quantity) || 0;
      const unitPrice = Number(li?.unitPrice) || 0;
      return { description, quantity, unitPrice, total: quantity * unitPrice };
    })
    .filter((li) => li.description.length > 0);
}

/**
 * GET the most recent invoice for this project, if any.
 */
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

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('[admin/quotes/invoice GET]', error);
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 });
  }
}

/**
 * Create or update the draft invoice for this project.
 * Body: { lineItems: [{ description, quantity, unitPrice }], notes? }
 */
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

    const body = await req.json().catch(() => ({} as any));
    const lineItems = normalizeLineItems(body?.lineItems || []);
    const notes = typeof body?.notes === 'string' ? body.notes : undefined;

    if (lineItems.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
    }

    const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
    const total = subtotal;

    const existingDraft = await prisma.invoice.findFirst({
      where: { projectId: params.id, status: 'draft' },
      orderBy: { createdAt: 'desc' },
    });

    let invoice;
    if (existingDraft) {
      invoice = await prisma.invoice.update({
        where: { id: existingDraft.id },
        data: {
          lineItems,
          subtotal,
          total,
          notes,
          updatedAt: new Date(),
        },
      });
    } else {
      invoice = await prisma.invoice.create({
        data: {
          projectId: params.id,
          invoiceNumber: generateInvoiceNumber(),
          lineItems,
          subtotal,
          total,
          notes,
        },
      });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('[admin/quotes/invoice POST]', error);
    return NextResponse.json(
      { error: 'Failed to save invoice', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
