import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  console.log('[TEST-CALL] Starting Claude test');
  
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('[TEST-CALL] API Key available:', !!apiKey);
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'ANTHROPIC_API_KEY not set',
        success: false,
      }, { status: 400 });
    }
    
    console.log('[TEST-CALL] Creating Anthropic client...');
    const client = new Anthropic({ apiKey });
    
    console.log('[TEST-CALL] Calling Claude API...');
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello" and nothing else.',
        },
      ],
    });
    
    console.log('[TEST-CALL] Response received');
    
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    
    return NextResponse.json({
      success: true,
      response: text,
      usage: response.usage,
    });
  } catch (error) {
    console.error('[TEST-CALL] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.constructor.name : typeof error;
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorType: errorType,
      fullError: String(error),
    }, { status: 500 });
  }
}
// Redeploy at Wed Jun  3 16:46:21 UTC 2026
