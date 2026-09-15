import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkSite } from '@/lib/site-check'
import { createNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

// Uptime poller for client sites. Like /api/cron/check-email-replies, this is
// hit by an external scheduler (cron-job.org — Vercel Hobby crons are
// daily-only) with ?secret=<CRON_SECRET>. Sends an admin notification when a
// site transitions up → down, and a recovery note when it comes back.
export async function GET(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get('secret')
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!prisma) return NextResponse.json({ error: 'No database' }, { status: 503 })

    const sites = await prisma.clientSite.findMany({
      include: { client: { select: { businessName: true } } },
    })

    const results: { site: string; ok: boolean; statusCode: number | null }[] = []
    for (const site of sites) {
      const checked = await checkSite(site.id)
      if (!checked) continue
      const { previousOk, result } = checked
      results.push({ site: site.name, ok: result.ok, statusCode: result.statusCode })

      if (previousOk !== false && !result.ok) {
        await createNotification({
          type: 'booking',
          title: `🔴 Site down: ${site.name}`,
          message: `${site.client.businessName} — ${site.url} returned ${result.statusCode ?? 'no response'}`,
          url: '/admin/clients',
        })
      } else if (previousOk === false && result.ok) {
        await createNotification({
          type: 'booking',
          title: `🟢 Site recovered: ${site.name}`,
          message: `${site.client.businessName} — ${site.url} is responding again (${result.statusCode}, ${result.latencyMs}ms)`,
          url: '/admin/clients',
        })
      }
    }

    return NextResponse.json({ checked: results.length, results })
  } catch (error) {
    console.error('Error in check-sites cron:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
