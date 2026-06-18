import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin session
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value
    if (!verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      lowEstimate,
      expectedEstimate,
      highEstimate,
      breakdown,
      materialRequirements,
      materialList,
      timeEstimation,
      selectedTier,
    } = body

    // Only mark the estimate as manually edited if something beyond the
    // tier selection actually changed — switching low/expected/high is not
    // itself an "edit" of the underlying numbers.
    const isSubstantiveEdit =
      lowEstimate !== undefined ||
      expectedEstimate !== undefined ||
      highEstimate !== undefined ||
      breakdown !== undefined ||
      materialRequirements !== undefined ||
      materialList !== undefined ||
      timeEstimation !== undefined

    const normalizedMaterialList = Array.isArray(materialList)
      ? materialList
          .map((m: any) => ({
            item: String(m?.item || '').trim(),
            quantity: Number(m?.quantity) || 1,
            unit: String(m?.unit || 'unit').trim(),
            estimatedPrice: Number(m?.estimatedPrice) || 0,
          }))
          .filter((m: any) => m.item.length > 0)
      : undefined

    const validTier =
      selectedTier === 'low' || selectedTier === 'expected' || selectedTier === 'high'
        ? selectedTier
        : undefined

    // Update estimate
    const estimate = await prisma.estimate.update({
      where: { projectId: params.id },
      data: {
        lowEstimate: lowEstimate !== undefined ? parseFloat(lowEstimate) : undefined,
        expectedEstimate: expectedEstimate !== undefined ? parseFloat(expectedEstimate) : undefined,
        highEstimate: highEstimate !== undefined ? parseFloat(highEstimate) : undefined,
        breakdown: breakdown || undefined,
        materialRequirements: materialRequirements || undefined,
        materialList: normalizedMaterialList,
        timeEstimation: timeEstimation || undefined,
        selectedTier: validTier,
        isEdited: isSubstantiveEdit ? true : undefined,
        updatedAt: new Date(),
      },
      include: {
        project: {
          include: { customer: true },
        },
      },
    })

    return NextResponse.json(estimate)
  } catch (error) {
    console.error('Error updating estimate:', error)
    return NextResponse.json(
      { error: 'Failed to update estimate' },
      { status: 500 }
    )
  }
}
