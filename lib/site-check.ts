import { prisma } from '@/lib/prisma'

export interface SiteCheckResult {
  ok: boolean
  statusCode: number | null
  latencyMs: number
}

// Fetch a site's URL and record the result on its ClientSite row.
// Returns the previous `lastOk` alongside the new result so callers can
// detect an up→down transition (for notifications).
export async function checkSite(siteId: string): Promise<{
  previousOk: boolean | null
  result: SiteCheckResult
} | null> {
  if (!prisma) return null
  const site = await prisma.clientSite.findUnique({ where: { id: siteId } })
  if (!site) return null

  const previousOk = site.lastOk
  const started = Date.now()
  let statusCode: number | null = null
  let ok = false
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(site.url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'user-agent': 'HearthHollow-SiteMonitor/1.0' },
    })
    clearTimeout(timer)
    statusCode = res.status
    ok = res.status >= 200 && res.status < 400
  } catch {
    ok = false
  }
  const latencyMs = Date.now() - started

  await prisma.clientSite.update({
    where: { id: siteId },
    data: {
      lastCheckedAt: new Date(),
      lastStatusCode: statusCode,
      lastLatencyMs: latencyMs,
      lastOk: ok,
    },
  })

  return { previousOk, result: { ok, statusCode, latencyMs } }
}
