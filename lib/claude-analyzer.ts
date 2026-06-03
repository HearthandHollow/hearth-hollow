import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ProjectAnalysis {
  scope: string;
  complexity: number; // 1-10
  estimatedLabor: { hours: number; rate: number };
  materials: Array<{ item: string; qty: number; unitCost: number; total: number }>;
  travel: number;
  overhead: number;
  profitMargin: number;
  estimates: { low: number; expected: number; high: number };
  confidence: number; // 0-1
  flagsAndRisks: string[];
  recommendedNextStep: string;
}

export async function analyzeProject(
  description: string,
  imageUrls: string[],
  projectId?: string
): Promise<ProjectAnalysis> {
  console.log(`[Claude Analyzer] Starting analysis for project ${projectId}`);
  console.log(`[Claude Analyzer] Description: ${description.substring(0, 100)}...`);
  console.log(`[Claude Analyzer] Images: ${imageUrls.length}`);
  
  // Build message with vision
  const imageContent: any[] = [];
  
  // Add images if available
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

  const textContent = {
    type: "text" as const,
    text: `You are an expert handyman and project estimator with 15+ years of experience. 

CRITICAL: This is project ID: ${projectId}
Generate COMPLETELY UNIQUE estimates for EACH project.
DO NOT return default estimates.
VARY your estimates significantly based on the project description provided.

PROJECT DETAILS:
Category: ${description}

${imageUrls && imageUrls.length > 0 ? `Images: ${imageUrls.length} provided` : "NO IMAGES PROVIDED"}

Analyze THIS SPECIFIC project and return UNIQUE estimates. Not generic estimates.

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "scope": "Specific work needed for THIS project",
  "complexity": <number 1-10>,
  "estimatedLabor": {"hours": <number>, "rate": <50-75>},
  "materials": [{"item": "<specific item>", "qty": <number>, "unitCost": <number>, "total": <number>}],
  "travel": <25-50>,
  "overhead": <number>,
  "profitMargin": <0.25-0.35>,
  "estimates": {"low": <number>, "expected": <number>, "high": <number>},
  "confidence": <0-1>,
  "flagsAndRisks": ["<specific concern>"],
  "recommendedNextStep": "<specific next action>"
}`,
  };

  const messageContent = imageContent.length > 0 
    ? [...imageContent, textContent]
    : [textContent];

  console.log(`[Claude Analyzer] Calling Claude API...`);
  
  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: messageContent as any,
      },
    ],
  });

  // Extract JSON from response
  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  console.log(`[Claude Analyzer] Raw response: ${responseText.substring(0, 200)}...`);

  // Parse JSON - be strict and handle various formats
  let jsonStr = responseText.trim();
  
  // Remove markdown code blocks if present
  if (jsonStr.includes("```json")) {
    jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
  } else if (jsonStr.includes("```")) {
    jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
  }

  // Find JSON object boundaries
  const jsonStart = jsonStr.indexOf("{");
  const jsonEnd = jsonStr.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
  }

  // Parse JSON
  const parsed = JSON.parse(jsonStr);

  console.log(`[Claude Analyzer] Parsed estimates - Low: ${parsed.estimates?.low}, Expected: ${parsed.estimates?.expected}, High: ${parsed.estimates?.high}`);

  // Validate and return with defaults
  return {
    scope: parsed.scope || "Project analysis required",
    complexity: Math.max(1, Math.min(10, parseInt(parsed.complexity) || 5)),
    estimatedLabor: {
      hours: Math.max(0.5, parseFloat(parsed.estimatedLabor?.hours) || 4),
      rate: Math.max(30, parseFloat(parsed.estimatedLabor?.rate) || 60),
    },
    materials: Array.isArray(parsed.materials) ? parsed.materials : [],
    travel: Math.max(0, parseFloat(parsed.travel) || 35),
    overhead: Math.max(0, parseFloat(parsed.overhead) || 100),
    profitMargin: Math.max(0.1, Math.min(0.5, parseFloat(parsed.profitMargin) || 0.3)),
    estimates: {
      low: Math.max(100, parseFloat(parsed.estimates?.low) || 800),
      expected: Math.max(200, parseFloat(parsed.estimates?.expected) || 1200),
      high: Math.max(300, parseFloat(parsed.estimates?.high) || 1600),
    },
    confidence: Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.5)),
    flagsAndRisks: Array.isArray(parsed.flagsAndRisks) ? parsed.flagsAndRisks : [],
    recommendedNextStep: parsed.recommendedNextStep || "Schedule site visit for exact measurements",
  };
}

// Legacy wrapper function for API route compatibility
export async function analyzeWithClaude(
  quote: any,
  uploadedAssets: any[]
): Promise<any> {
  console.log(`[analyzeWithClaude] Processing quote ${quote.id}`);
  console.log(`[analyzeWithClaude] Category: ${quote.category}`);
  console.log(`[analyzeWithClaude] Description: ${quote.description}`);
  
  // Extract image URLs from uploaded assets
  const imageUrls = uploadedAssets
    .map((asset: any) => asset.url || asset.s3Url)
    .filter((url: any) => !!url);

  console.log(`[analyzeWithClaude] Found ${imageUrls.length} images`);

  // Call the new analyzeProject function
  const analysis = await analyzeProject(
    quote.description,
    imageUrls,
    quote.id
  );

  console.log(`[analyzeWithClaude] Final estimates - Low: ${analysis.estimates.low}, Expected: ${analysis.estimates.expected}, High: ${analysis.estimates.high}`);

  // Transform to legacy format expected by the API route
  // Use Claude's estimates directly (they're already calculated and unique per project)
  const materialsCost = analysis.materials.reduce(
    (sum: number, m: any) => sum + (m.total || 0),
    0
  );
  const laborCost = analysis.estimatedLabor.hours * analysis.estimatedLabor.rate;

  return {
    scope: analysis.scope,
    complexity: analysis.complexity,
    estimatedLabor: analysis.estimatedLabor,
    materials: analysis.materials,
    travel: analysis.travel,
    overhead: analysis.overhead,
    profitMargin: analysis.profitMargin,
    lowEstimate: Math.round(analysis.estimates.low),
    expectedEstimate: Math.round(analysis.estimates.expected),
    highEstimate: Math.round(analysis.estimates.high),
    confidence: analysis.confidence,
    breakdown: `
**Project Scope:** ${analysis.scope}

**Complexity:** ${analysis.complexity}/10

**Materials:**
${analysis.materials.map((m: any) => `- ${m.item}: $${m.total || 0}`).join("\n") || "None specified"}

**Labor:** ${analysis.estimatedLabor.hours} hours @ $${analysis.estimatedLabor.rate}/hr = $${laborCost}
**Travel:** $${analysis.travel}
**Overhead:** $${analysis.overhead}

**Risks & Flags:**
${analysis.flagsAndRisks.map((f: any) => `- ${f}`).join("\n") || "None identified"}

**Next Steps:**
${analysis.recommendedNextStep}
    `,
    fullAnalysis: JSON.stringify(analysis, null, 2),
  };
}
