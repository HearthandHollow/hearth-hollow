import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Resolves to the current app icon. The root layout points the browser
// favicon / apple-touch-icon at this stable URL, so the tab icon follows the
// admin-configured ThemeSettings.appIconUrl without making every page read the
// DB during render. Redirects to the configured icon, or the bundled default.
export const dynamic = 'force-dynamic'

const DEFAULT_ICON = '/icons/apple-touch-icon.png'

export async function GET(request: Request) {
  let appIconUrl: string | null = null
  try {
    const theme = await prisma.themeSettings.findFirst()
    if (theme?.appIconUrl) appIconUrl = theme.appIconUrl
  } catch {
    // fall through to default
  }

  const target = appIconUrl
    ? appIconUrl
    : new URL(DEFAULT_ICON, request.url).toString()

  return NextResponse.redirect(target, { status: 307 })
}
