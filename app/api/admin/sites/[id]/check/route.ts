import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkSite } from '@/lib/site-check'

export const dynamic = 'force-dynamic'

async function isAuthenticated() {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get('admin_session')?.value)
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!prisma) return NextResponse.json({ error: 'No database' }, { status: 503 })

    const checked = await checkSite(params.id)
    if (!checked) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(checked.result)
  } catch (error) {
    console.error('Error checking site:', error)
    return NextResponse.json({ error: 'Failed to check site' }, { status: 500 })
  }
}
