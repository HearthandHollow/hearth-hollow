import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function isAuthenticated() {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get('admin_session')?.value)
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

    const body = await req.json()
    const name = (body.name || '').trim()
    const url = (body.url || '').trim()
    if (!name || !url) {
      return NextResponse.json({ error: 'Site name and URL are required' }, { status: 400 })
    }

    const site = await prisma.clientSite.create({
      data: {
        clientId: params.id,
        name,
        url,
        stagingUrl: body.stagingUrl?.trim() || null,
        repoUrl: body.repoUrl?.trim() || null,
        hostingNotes: body.hostingNotes || null,
        ga4PropertyId: body.ga4PropertyId?.trim() || null,
      },
    })
    return NextResponse.json({ site })
  } catch (error) {
    console.error('Error creating site:', error)
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 })
  }
}
