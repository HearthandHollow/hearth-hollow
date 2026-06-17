import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
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
      { error: 'Failed to fetch theme' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value
    if (!verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await req.json()

    let theme = await prisma.themeSettings.findFirst()

    if (!theme) {
      theme = await prisma.themeSettings.create({
        data,
      })
    } else {
      theme = await prisma.themeSettings.update({
        where: { id: theme.id },
        data,
      })
    }

    return NextResponse.json(theme)
  } catch (error) {
    console.error('Error updating theme:', error)
    return NextResponse.json(
      { error: 'Failed to update theme' },
      { status: 500 }
    )
  }
}
