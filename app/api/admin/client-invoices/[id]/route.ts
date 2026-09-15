import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function isAuthenticated() {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get('admin_session')?.value)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!prisma) return NextResponse.json({ error: 'No database' }, { status: 503 })

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.status === 'paid') {
      data.status = 'paid'
      data.paidAt = new Date()
    } else if (body.status !== undefined) {
      data.status = body.status
    }
    if (body.notes !== undefined) data.notes = body.notes || null

    const invoice = await prisma.clientInvoice.update({ where: { id: params.id }, data })
    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Error updating client invoice:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!prisma) return NextResponse.json({ error: 'No database' }, { status: 503 })

    const invoice = await prisma.clientInvoice.findUnique({ where: { id: params.id } })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Paid invoices cannot be deleted' }, { status: 400 })
    }
    await prisma.clientInvoice.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting client invoice:', error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
