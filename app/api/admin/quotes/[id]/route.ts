import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function isAuthenticated(req: NextRequest) {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get('admin_session')?.value);
}

// GET - Fetch quote details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!await isAuthenticated(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const quote = await prisma.projectRequest.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        uploadedAssets: true,
        estimate: true,
      },
    });

    if (!quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}

// PATCH - Update quote details
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!await isAuthenticated(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { description, category, location, timeline } = body;

    // Update the quote
    const quote = await prisma.projectRequest.update({
      where: { id: params.id },
      data: {
        ...(description && { description }),
        ...(category && { category }),
        ...(location !== undefined && { location }),
        ...(timeline !== undefined && { timeline }),
      },
      include: {
        customer: true,
        uploadedAssets: true,
        estimate: true,
      },
    });

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Error updating quote:', error);
    return NextResponse.json(
      { error: 'Failed to update quote' },
      { status: 500 }
    );
  }
}
