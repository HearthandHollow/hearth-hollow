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

    console.log(`Analyzing quote ${params.id}...`);
    console.log(`API Key available: ${!!process.env.ANTHROPIC_API_KEY}`);

    // Analyze with Claude
    let analysis;
    try {
      analysis = await analyzeWithClaude(quote, quote.uploadedAssets || []);
    } catch (claudeError) {
      console.error('Claude analysis failed:', claudeError);
      
      // Fallback: Generate a basic estimate without Claude
      console.log('Generating fallback estimate...');
      analysis = {
        scope: quote.description.substring(0, 100),
        complexity: 5,
        estimatedLabor: { hours: 8, rate: 60 },
        materials: [],
        travel: 35,
        overhead: 100,
        profitMargin: 200,
        lowEstimate: 800,
        expectedEstimate: 1100,
        highEstimate: 1500,
        confidence: 0.3,
        breakdown: `Project: ${quote.category}\nDescription: ${quote.description}\n\nEstimate ranges from $800-$1500. Please review photos and adjust as needed.`,
        fullAnalysis: 'Fallback estimate - Claude API not available',
      };
    }

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

    console.log(`Quote ${params.id} analyzed successfully`);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error analyzing quote:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze quote',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
