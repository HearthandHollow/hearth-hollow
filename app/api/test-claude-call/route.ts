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
    const models = ['claude-3-sonnet-20240229', 'claude-3-5-sonnet-20241022'];
    let response;
    let modelUsed = '';
    let lastError = null;
    
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
        lastError = error;
        console.error(`[TEST-CALL] Failed with ${model}`);
        console.error(`[TEST-CALL] Error message: ${error?.message}`);
        console.error(`[TEST-CALL] Error type: ${error?.type}`);
        console.error(`[TEST-CALL] Error status: ${error?.status}`);
        
        // Check if it's a 404 model not found error
        const errorStr = JSON.stringify(error);
        if (errorStr.includes('not_found') || error?.status === 404) {
          console.log(`[TEST-CALL] Model not found, trying next...`);
          continue;
        }
        
        // Otherwise, throw this error
        throw error;
      }
    }
    
    if (!response) {
      console.error('[TEST-CALL] No response from any model');
      throw lastError || new Error('Could not use any available model');
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
