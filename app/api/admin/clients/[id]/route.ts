import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function isAuthenticated() {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get('admin_session')?.value)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!prisma) return NextResponse.json({ error: 'No database' }, { status: 503 })

    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        sites: { orderBy: { createdAt: 'asc' } },
        invoices: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ client })
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 })
  }
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
    if (body.businessName !== undefined) data.businessName = String(body.businessName).trim()
    if (body.contactName !== undefined) data.contactName = body.contactName?.trim() || null
    if (body.email !== undefined) data.email = body.email?.trim() || null
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null
    if (body.status !== undefined) data.status = body.status
    if (body.notes !== undefined) data.notes = body.notes || null
    if (body.monthlyRate !== undefined)
      data.monthlyRate = body.monthlyRate === '' || body.monthlyRate == null ? null : Number(body.monthlyRate)
    if (body.billingDay !== undefined)
      data.billingDay = body.billingDay === '' || body.billingDay == null ? null : Number(body.billingDay)

    const client = await prisma.client.update({ where: { id: params.id }, data })
    return NextResponse.json({ client })
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
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

    await prisma.client.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }
}
