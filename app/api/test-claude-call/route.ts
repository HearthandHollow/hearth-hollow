import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'ANTHROPIC_API_KEY not set',
        success: false,
      }, { status: 400 });
    }
    
    const client = new Anthropic({ apiKey });
    
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello" and nothing else.',
        },
      ],
    });
    
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    
    return NextResponse.json({
      success: true,
      response: text,
      model: 'claude-3-5-haiku-20241022',
      usage: response.usage,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
