import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Theme is DB-backed; always render live instead of caching at build time.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!prisma) throw new Error('Database not available')
    let theme = await prisma.themeSettings.findFirst()

    if (!theme) {
      theme = await prisma.themeSettings.create({
        data: {},
      })
    }

    return NextResponse.json(theme)
  } catch (error) {
    console.error('Error fetching theme:', error)
    return NextResponse.json(
      {
        primaryColor: '#b45309',
        secondaryColor: '#78350f',
        accentColor: '#ea580c',
        textPrimary: '#1f2937',
        textSecondary: '#6b7280',
        backgroundColor: '#f9fafb',
        borderColor: '#e5e7eb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        headingFont: 'system-ui, -apple-system, sans-serif',
        siteName: 'Hearth & Hollow',
        siteDescription: 'Custom handyman and carpentry services',
        heroImageUrl: 'https://images.unsplash.com/photo-1757605327126-9baefea3348b?auto=format&fit=crop&w=1600&q=80',
        craftImageUrl: 'https://images.unsplash.com/photo-1631396326646-c06a935ff3a6?auto=format&fit=crop&w=1200&q=80',
        gatheringImageUrl: 'https://images.unsplash.com/photo-1746701905946-f1babf656914?auto=format&fit=crop&w=1200&q=80',
        homesteadImageUrl: 'https://images.unsplash.com/photo-1771425890623-f17451025495?auto=format&fit=crop&w=1200&q=80',
      },
      { status: 200 }
    )
  }
}
