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

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[ROUTE] Analyzing quote ${params.id}`);
    console.log(`[ROUTE] API Key present: ${!!process.env.ANTHROPIC_API_KEY}`);
    console.log(`${'='.repeat(80)}\n`);

    // Analyze with Claude
    let analysis: any;
    try {
      console.log(`[ROUTE] Calling analyzeWithClaude...`);
      analysis = await analyzeWithClaude(quote, quote.uploadedAssets || []);
      console.log(`[ROUTE] ✅ Claude analysis succeeded`);
    } catch (claudeError) {
      console.error(`[ROUTE] ❌ Claude analysis FAILED`);
      console.error(`[ROUTE] Error type:`, claudeError instanceof Error ? claudeError.constructor.name : typeof claudeError);
      console.error(`[ROUTE] Error message:`, claudeError instanceof Error ? claudeError.message : String(claudeError));
      if (claudeError instanceof Error && claudeError.stack) {
        console.error(`[ROUTE] Stack:`, claudeError.stack);
      }
      
      // DO NOT USE FALLBACK - FAIL SO WE CAN SEE THE ERROR
      return NextResponse.json(
        { 
          error: 'Claude analysis failed',
          details: claudeError instanceof Error ? claudeError.message : String(claudeError),
          suggestion: 'Check that ANTHROPIC_API_KEY is set in Vercel environment variables'
        },
        { status: 500 }
      );
    }

    console.log(`[ROUTE] Saving estimate to database...`);

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

    console.log(`[ROUTE] ✅ Estimate saved`);

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

    console.log(`[ROUTE] ✅ Quote ${params.id} analyzed successfully`);
    console.log(`[ROUTE] Estimates - Low: $${analysis.lowEstimate}, Expected: $${analysis.expectedEstimate}, High: $${analysis.highEstimate}`);
    console.log(`${'='.repeat(80)}\n`);

    return NextResponse.json(updated);
  } catch (error) {
    console.error(`[ROUTE] Unexpected error:`, error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze quote',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
