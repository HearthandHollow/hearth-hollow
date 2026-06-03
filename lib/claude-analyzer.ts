import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ProjectAnalysis {
  scope: string;
  complexity: number;
  estimatedLabor: { hours: number; rate: number };
  materials: Array<{ item: string; qty: number; unitCost: number; total: number }>;
  travel: number;
  overhead: number;
  profitMargin: number;
  estimates: { low: number; expected: number; high: number };
  confidence: number;
  flagsAndRisks: string[];
  recommendedNextStep: string;
}

export async function analyzeProject(
  description: string,
  imageUrls: string[],
  projectId?: string
): Promise<ProjectAnalysis> {
  console.log(`[Claude] Analyzing project ${projectId}: ${description.substring(0, 50)}...`);

  const imageContent: any[] = [];
  
  if (imageUrls && imageUrls.length > 0) {
    for (const url of imageUrls) {
      if (url) {
        imageContent.push({
          type: "image" as const,
          source: {
            type: "url" as const,
            url: url,
          },
        });
      }
    }
  }

  // SIMPLIFIED PROMPT - Forces Claude to return specific numbers
  const textContent = {
    type: "text" as const,
    text: `You are a handyman estimator. Analyze this project and return ONLY a JSON object with cost estimates.

PROJECT: ${description}

INSTRUCTIONS:
- Return ONLY valid JSON (no markdown, no explanation)
- Each project must have DIFFERENT estimates based on the description
- Complexity: rate 1-10 based on this specific project
- low_estimate: minimum cost for THIS project
- expected_estimate: most likely cost for THIS project  
- high_estimate: maximum cost for THIS project
- These MUST be different numbers for different projects, not formulas

RESPOND WITH ONLY THIS JSON STRUCTURE:
{
  "complexity": <1-10 number based on project>,
  "low_estimate": <number>,
  "expected_estimate": <number>,
  "high_estimate": <number>,
  "scope": "<what needs to be done>",
  "risk_factors": ["<specific risk>"]
}

Respond with ONLY the JSON object, nothing else.`,
  };

  const messageContent = imageContent.length > 0 
    ? [...imageContent, textContent]
    : [textContent];

  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: messageContent as any,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    console.log(`[Claude] Raw response: ${responseText.substring(0, 200)}`);

    // Parse JSON
    let jsonStr = responseText.trim();
    
    // Remove markdown if present
    if (jsonStr.includes("```json")) {
      jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    } else if (jsonStr.includes("```")) {
      jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }

    // Extract JSON
    const jsonStart = jsonStr.indexOf("{");
    const jsonEnd = jsonStr.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
    }

    const parsed = JSON.parse(jsonStr);
    
    const low = parseInt(parsed.low_estimate) || parseInt(parsed.lowEstimate) || 0;
    const expected = parseInt(parsed.expected_estimate) || parseInt(parsed.expectedEstimate) || 0;
    const high = parseInt(parsed.high_estimate) || parseInt(parsed.highEstimate) || 0;
    
    console.log(`[Claude] Parsed - Low: $${low}, Expected: $${expected}, High: $${high}`);

    // If Claude didn't return good estimates, log it
    if (low === 0 || expected === 0 || high === 0) {
      console.warn(`[Claude] WARNING: Claude returned zero estimates! Full response: ${responseText}`);
    }

    return {
      scope: parsed.scope || description.substring(0, 100),
      complexity: Math.max(1, Math.min(10, parsed.complexity || 5)),
      estimatedLabor: {
        hours: Math.max(1, low > 0 ? Math.round(expected / 65) : 4),
        rate: 65,
      },
      materials: [],
      travel: 35,
      overhead: Math.max(50, Math.round(expected * 0.1)),
      profitMargin: 0.25,
      estimates: {
        low: Math.max(100, low),
        expected: Math.max(200, expected),
        high: Math.max(300, high),
      },
      confidence: 0.7,
      flagsAndRisks: parsed.risk_factors || [],
      recommendedNextStep: "Review estimate and confirm details",
    };
  } catch (error) {
    console.error(`[Claude] ERROR:`, error);
    throw error;
  }
}

export async function analyzeWithClaude(
  quote: any,
  uploadedAssets: any[]
): Promise<any> {
  const imageUrls = uploadedAssets
    .map((asset: any) => asset.url || asset.s3Url)
    .filter((url: any) => !!url);

  const analysis = await analyzeProject(
    quote.description,
    imageUrls,
    quote.id
  );

  return {
    scope: analysis.scope,
    complexity: analysis.complexity,
    estimatedLabor: analysis.estimatedLabor,
    materials: analysis.materials,
    travel: analysis.travel,
    overhead: analysis.overhead,
    profitMargin: analysis.profitMargin,
    lowEstimate: analysis.estimates.low,
    expectedEstimate: analysis.estimates.expected,
    highEstimate: analysis.estimates.high,
    confidence: analysis.confidence,
    breakdown: `
**Scope:** ${analysis.scope}
**Complexity:** ${analysis.complexity}/10
**Estimates:**
- Low: $${analysis.estimates.low}
- Expected: $${analysis.estimates.expected}
- High: $${analysis.estimates.high}

**Risks:** ${analysis.flagsAndRisks.join(", ") || "None identified"}
    `,
    fullAnalysis: JSON.stringify(analysis, null, 2),
  };
}
