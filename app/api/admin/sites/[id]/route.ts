import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
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
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.url !== undefined) data.url = String(body.url).trim()
    if (body.stagingUrl !== undefined) data.stagingUrl = body.stagingUrl?.trim() || null
    if (body.repoUrl !== undefined) data.repoUrl = body.repoUrl?.trim() || null
    if (body.hostingNotes !== undefined) data.hostingNotes = body.hostingNotes || null
    if (body.ga4PropertyId !== undefined) data.ga4PropertyId = body.ga4PropertyId?.trim() || null
    if (body.config !== undefined) data.config = body.config
    if (body.rotateToken === true) data.configToken = randomUUID()

    const site = await prisma.clientSite.update({ where: { id: params.id }, data })
    return NextResponse.json({ site })
  } catch (error) {
    console.error('Error updating site:', error)
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 })
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

    await prisma.clientSite.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting site:', error)
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 })
  }
}
