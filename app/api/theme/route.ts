import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
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
      },
      { status: 200 }
    )
  }
}
