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
    
    // Try models in order
    const models = ['claude-3-5-sonnet-20241022', 'claude-3-sonnet-20240229'];
    let response;
    let modelUsed = '';
    
    for (const model of models) {
      try {
        console.log(`[TEST-CALL] Trying model: ${model}`);
        response = await client.messages.create({
          model: model as any,
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'Say "Hello" and nothing else.',
            },
          ],
        });
        modelUsed = model;
        console.log(`[TEST-CALL] Success with ${model}`);
        break;
      } catch (error: any) {
        console.error(`[TEST-CALL] Failed with ${model}:`, error.message);
        if (error.status === 404 || error.error?.type === 'not_found_error') {
          console.log(`[TEST-CALL] Model not found, trying next...`);
          continue;
        }
        throw error;
      }
    }
    
    if (!response) {
      throw new Error('Could not use any available model');
    }
    
    console.log('[TEST-CALL] Response received');
    
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    
    return NextResponse.json({
      success: true,
      response: text,
      model: modelUsed,
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
