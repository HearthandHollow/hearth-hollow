import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function isAuthenticated() {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get('admin_session')?.value)
}

interface LineItem {
  description: string
  amount: number
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!prisma) return NextResponse.json({ error: 'No database' }, { status: 503 })

    const client = await prisma.client.findUnique({ where: { id: params.id } })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const body = await req.json()
    const rawItems: LineItem[] = Array.isArray(body.lineItems) ? body.lineItems : []
    const lineItems = rawItems
      .map((li) => ({ description: String(li.description || '').trim(), amount: Number(li.amount) }))
      .filter((li) => li.description && Number.isFinite(li.amount) && li.amount > 0)
    if (lineItems.length === 0) {
      return NextResponse.json({ error: 'At least one line item with a positive amount is required' }, { status: 400 })
    }
    const total = Math.round(lineItems.reduce((sum, li) => sum + li.amount, 0) * 100) / 100

    const now = new Date()
    const periodLabel: string =
      (body.periodLabel || '').trim() ||
      now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

    // HH-CLI-YYYYMM-NNN, sequenced within the month
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const countThisMonth = await prisma.clientInvoice.count({
      where: { invoiceNumber: { startsWith: `HH-CLI-${yyyymm}-` } },
    })
    const invoiceNumber = `HH-CLI-${yyyymm}-${String(countThisMonth + 1).padStart(3, '0')}`

    const invoice = await prisma.clientInvoice.create({
      data: {
        clientId: params.id,
        invoiceNumber,
        periodLabel,
        lineItems,
        total,
        notes: body.notes || null,
      },
    })
    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Error creating client invoice:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
