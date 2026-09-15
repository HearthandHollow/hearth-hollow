import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function isAuthenticated() {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get('admin_session')?.value)
}

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!prisma) return NextResponse.json({ error: 'No database' }, { status: 503 })

    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        sites: { orderBy: { createdAt: 'asc' } },
        invoices: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    })
    return NextResponse.json({ clients })
  } catch (error) {
    console.error('Error listing clients:', error)
    return NextResponse.json({ error: 'Failed to list clients' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!prisma) return NextResponse.json({ error: 'No database' }, { status: 503 })

    const body = await req.json()
    const businessName = (body.businessName || '').trim()
    if (!businessName) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }

    const client = await prisma.client.create({
      data: {
        businessName,
        contactName: body.contactName?.trim() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        status: body.status || 'active',
        notes: body.notes || null,
        monthlyRate: body.monthlyRate != null && body.monthlyRate !== '' ? Number(body.monthlyRate) : null,
        billingDay: body.billingDay != null && body.billingDay !== '' ? Number(body.billingDay) : null,
      },
    })
    return NextResponse.json({ client })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
