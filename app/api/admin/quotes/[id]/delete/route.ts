import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin session
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the quote
    const project = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: {
        uploadedAssets: true,
        estimate: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Delete uploaded assets (they'll cascade delete via Prisma)
    // Delete estimate (will cascade delete via Prisma)
    // Delete the project request
    await prisma.projectRequest.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      message: 'Quote deleted successfully',
      id: params.id,
    })
  } catch (error) {
    console.error('Error deleting quote:', error)
    return NextResponse.json(
      { error: 'Failed to delete quote', details: String(error) },
      { status: 500 }
    )
  }
}
