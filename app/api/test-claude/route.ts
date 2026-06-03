import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  console.log('[TEST] Claude environment check');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  console.log('[TEST] API Key available:', !!apiKey);
  if (apiKey) {
    console.log('[TEST] API Key length:', apiKey.length);
    console.log('[TEST] API Key prefix:', apiKey.substring(0, 10));
  }
  
  return NextResponse.json({
    apiKeyAvailable: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) : 'NONE',
    nodeEnv: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env)
      .filter(k => k.includes('ANTHROPIC') || k.includes('API') || k.includes('CLAUDE'))
      .sort(),
  });
}
