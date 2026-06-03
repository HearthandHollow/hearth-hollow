import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { analyzeWithClaude } from '@/lib/claude-analyzer';

async function isAuthenticated(req: NextRequest) {
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value === 'authenticated';
}

export async function POST(
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

    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
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

    // Analyze with Claude
    const analysis = await analyzeWithClaude(quote, quote.uploadedAssets || []);

    // Save estimate
    const estimate = await prisma.estimate.upsert({
      where: { projectId: params.id },
      create: {
        projectId: params.id,
        lowEstimate: analysis.lowEstimate,
        expectedEstimate: analysis.expectedEstimate,
        highEstimate: analysis.highEstimate,
        breakdown: analysis.breakdown,
        confidence: analysis.confidence,
        rawAnalysis: analysis.fullAnalysis,
      },
      update: {
        lowEstimate: analysis.lowEstimate,
        expectedEstimate: analysis.expectedEstimate,
        highEstimate: analysis.highEstimate,
        breakdown: analysis.breakdown,
        confidence: analysis.confidence,
        rawAnalysis: analysis.fullAnalysis,
      },
    });

    // Update project status
    const updated = await prisma.projectRequest.update({
      where: { id: params.id },
      data: { status: 'analyzed' },
      include: {
        customer: true,
        uploadedAssets: true,
        estimate: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error analyzing quote:', error);
    return NextResponse.json(
      { error: 'Failed to analyze quote' },
      { status: 500 }
    );
  }
}
