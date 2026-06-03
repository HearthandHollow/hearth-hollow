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
  lowEstimate: number;
  expectedEstimate: number;
  highEstimate: number;
  confidence: number;
  breakdown: string;
  fullAnalysis: string;
}

interface Asset {
  id: string;
  filename: string;
  s3Url: string;
  mimeType: string;
}

interface Quote {
  id: string;
  category: string;
  description: string;
  location?: string;
  timeline?: string;
}

export async function analyzeWithClaude(
  quote: Quote,
  assets: Asset[]
): Promise<ProjectAnalysis> {
  try {
    // Build image content from uploaded assets
    const imageContent = assets
      .filter(asset => asset.mimeType.startsWith('image'))
      .map(asset => ({
        type: "image" as const,
        source: {
          type: "url" as const,
          url: asset.s3Url,
        },
      }));

    const analysisPrompt = `You are an expert handyman and project estimator with 15+ years of experience.

Analyze this ${quote.category} project and provide a detailed cost estimate.

PROJECT DETAILS:
- Category: ${quote.category}
- Location: ${quote.location || 'Not specified'}
- Timeline: ${quote.timeline || 'Flexible'}
- Description: ${quote.description}

Based on the images and description, provide:
1. A clear scope of work
2. Labor estimate (hours and rate: $50-75/hr for starter)
3. Materials needed with costs
4. Travel costs
5. Three price estimates (low, expected, high)
6. Confidence score (0-1) based on how clear the project is

Respond with a JSON object:
{
  "scope": "clear summary of work",
  "complexity": 5,
  "laborHours": 8,
  "laborRate": 60,
  "materials": [{"item": "name", "qty": 1, "unitCost": 100, "total": 100}],
  "travelCost": 35,
  "overheadPercent": 0.15,
  "profitMargin": 0.25,
  "lowEstimate": 1000,
  "expectedEstimate": 1200,
  "highEstimate": 1500,
  "confidence": 0.8,
  "breakdown": "detailed breakdown text"
}`;

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: analysisPrompt,
            },
          ],
        },
      ],
    });

    // Extract text response
    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON
    let jsonStr = responseText;
    if (responseText.includes("```json")) {
      jsonStr = responseText.split("```json")[1].split("```")[0];
    } else if (responseText.includes("```")) {
      jsonStr = responseText.split("```")[1].split("```")[0];
    }

    const parsed = JSON.parse(jsonStr.trim());

    // Calculate totals
    const materialsCost = (parsed.materials || []).reduce(
      (sum: number, m: any) => sum + (m.total || 0),
      0
    );
    const laborCost = (parsed.laborHours || 8) * (parsed.laborRate || 60);
    const subtotal = laborCost + materialsCost + (parsed.travelCost || 0);
    const overhead = subtotal * (parsed.overheadPercent || 0.15);
    const profitMargin = (subtotal + overhead) * (parsed.profitMargin || 0.25);

    return {
      scope: parsed.scope || "Project work",
      complexity: parsed.complexity || 5,
      estimatedLabor: {
        hours: parsed.laborHours || 8,
        rate: parsed.laborRate || 60,
      },
      materials: parsed.materials || [],
      travel: parsed.travelCost || 35,
      overhead,
      profitMargin,
      lowEstimate: Math.round(parsed.lowEstimate || subtotal),
      expectedEstimate: Math.round(parsed.expectedEstimate || subtotal + overhead + profitMargin),
      highEstimate: Math.round(parsed.highEstimate || (subtotal + overhead + profitMargin) * 1.2),
      confidence: parsed.confidence || 0.5,
      breakdown: parsed.breakdown || formatBreakdown(parsed),
      fullAnalysis: responseText,
    };
  } catch (error) {
    console.error("Claude analysis error:", error);
    throw new Error("Failed to analyze project with Claude");
  }
}

function formatBreakdown(analysis: any): string {
  const lines = [
    `SCOPE: ${analysis.scope || 'Project work'}`,
    `COMPLEXITY: ${analysis.complexity || 5}/10`,
    '',
    'LABOR:',
    `  Hours: ${analysis.laborHours || 8}h @ $${analysis.laborRate || 60}/hr = $${((analysis.laborHours || 8) * (analysis.laborRate || 60)).toLocaleString()}`,
    '',
    'MATERIALS:',
  ];

  if (analysis.materials && analysis.materials.length > 0) {
    analysis.materials.forEach((m: any) => {
      lines.push(`  ${m.item}: ${m.qty}x @ $${m.unitCost} = $${m.total?.toLocaleString()}`);
    });
  } else {
    lines.push('  TBD on site visit');
  }

  lines.push('');
  lines.push(`TRAVEL: $${analysis.travelCost || 35}`);
  lines.push('');
  lines.push('COST SUMMARY:');
  const laborCost = (analysis.laborHours || 8) * (analysis.laborRate || 60);
  const matCost = (analysis.materials || []).reduce((sum: number, m: any) => sum + (m.total || 0), 0);
  const subtotal = laborCost + matCost + (analysis.travelCost || 35);
  const overhead = subtotal * (analysis.overheadPercent || 0.15);
  lines.push(`  Labor: $${laborCost.toLocaleString()}`);
  lines.push(`  Materials: $${matCost.toLocaleString()}`);
  lines.push(`  Travel: $${analysis.travelCost || 35}`);
  lines.push(`  Overhead (15%): $${Math.round(overhead).toLocaleString()}`);
  lines.push('');
  lines.push(`ESTIMATES:`);
  lines.push(`  Low: $${analysis.lowEstimate?.toLocaleString()}`);
  lines.push(`  Expected: $${analysis.expectedEstimate?.toLocaleString()}`);
  lines.push(`  High: $${analysis.highEstimate?.toLocaleString()}`);

  return lines.join('\n');
}

export async function analyzeProject(
  description: string,
  imageUrls: string[]
): Promise<ProjectAnalysis> {
  const quote: Quote = {
    id: 'temp',
    category: 'general',
    description,
  };

  const assets: Asset[] = imageUrls.map((url, i) => ({
    id: `img-${i}`,
    filename: `image-${i}.jpg`,
    s3Url: url,
    mimeType: 'image/jpeg',
  }));

  return analyzeWithClaude(quote, assets);
}
