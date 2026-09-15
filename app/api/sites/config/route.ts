import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Public, token-authenticated read of one client site's live config.
// The client site fetches this on page load:
//   fetch('https://thehearthhollow.com/api/sites/config?token=<configToken>')
// CORS is wide open on purpose — the token is the credential, and the payload
// is content the site displays publicly anyway. Rotate the token from the
// admin Clients page to revoke access.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'No database' }, { status: 503, headers: CORS_HEADERS })
    }
    const token = req.nextUrl.searchParams.get('token') || ''
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400, headers: CORS_HEADERS })
    }
    const site = await prisma.clientSite.findUnique({
      where: { configToken: token },
      select: { config: true, updatedAt: true },
    })
    if (!site) {
      return NextResponse.json({ error: 'Unknown token' }, { status: 404, headers: CORS_HEADERS })
    }
    return NextResponse.json(
      { config: site.config, updatedAt: site.updatedAt },
      { headers: CORS_HEADERS }
    )
  } catch (error) {
    console.error('Error serving site config:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: CORS_HEADERS })
  }
}
