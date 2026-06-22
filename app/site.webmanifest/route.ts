import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Dynamic web app manifest. Served at /site.webmanifest and linked from the
// root layout. Reads the admin-configured app icon (ThemeSettings.appIconUrl)
// so the installed home-screen icon can be changed from the theme settings
// without a redeploy. Falls back to the bundled /icons/* defaults.
export const dynamic = 'force-dynamic'

export async function GET() {
  let appIconUrl: string | null = null
  let siteName = 'The Hearth & Hollow'
  try {
    const theme = await prisma.themeSettings.findFirst()
    if (theme?.appIconUrl) appIconUrl = theme.appIconUrl
    if (theme?.siteName) siteName = theme.siteName
  } catch {
    // DB unavailable — fall back to defaults below.
  }

  const icons = appIconUrl
    ? [
        { src: appIconUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: appIconUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: appIconUrl, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]
    : [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]

  const manifest = {
    name: `${siteName} Admin`,
    short_name: 'H&H Admin',
    description:
      'Admin dashboard for The Hearth and Hollow — quotes, conversations, and scheduling.',
    start_url: '/admin/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f9fafb',
    theme_color: '#78350f',
    icons,
  }

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-store',
    },
  })
}
