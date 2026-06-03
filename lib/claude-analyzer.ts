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
    
CRITICAL: This is project #${projectId || "unknown"}. Generate COMPLETELY UNIQUE estimates for each project based on the actual details provided. NEVER return the same estimate twice.

PROJECT DESCRIPTION:
${description}

${imageUrls && imageUrls.length > 0 ? `Images provided: ${imageUrls.length} photo(s)` : "No photos provided"}

Based on the provided images and description, generate a detailed, UNIQUE JSON response with:

1. **Scope**: Detailed summary of exactly what needs to be done for THIS project (not generic)
2. **Complexity**: Rate 1-10 based on THIS specific project (1=trivial, 10=extremely complex)
3. **EstimatedLabor**: Specific hours and hourly rate for THIS project (use $50-75/hr base)
4. **Materials**: Specific items needed for THIS project (not generic - include actual quantities and costs)
5. **Travel**: Estimate based on described location (usually $25-50)
6. **Overhead**: 15% of labor subtotal (for business operations)
7. **ProfitMargin**: 0.25-0.35 (25-35% of total cost)
8. **Estimates**: 
   - low: minimum cost (if everything goes perfectly)
   - expected: most likely cost
   - high: maximum cost (if complications arise)
   MUST VARY SIGNIFICANTLY based on project complexity and unknowns
9. **Confidence**: 0-1 score (1.0 = very clear, 0.0 = very unclear)
   - Lower if photos are blurry or description is vague
   - Higher if photos are clear and description is detailed
10. **FlagsAndRisks**: Array of specific concerns for THIS project (not generic)
    - Example: "Foundation appears uneven - may need leveling"
    - Example: "Old plumbing may require replacement"
    - Be specific to what you see/infer
11. **RecommendedNextStep**: Specific next action for THIS project
    - Example: "Site visit needed to measure exactly"
    - Example: "Send additional photos of corner damage"

RESPOND WITH ONLY VALID JSON - NO MARKDOWN CODE BLOCKS, NO EXPLANATION TEXT, NO EXTRA COMMENTARY.
Start immediately with "{" and end with "}"

EXAMPLE FORMAT (but generate unique data for each project):
{
  "scope": "Replace worn kitchen faucet, caulk around sink, fix cabinet hinge",
  "complexity": 3,
  "estimatedLabor": {"hours": 3, "rate": 60},
  "materials": [
    {"item": "Faucet (mid-range)", "qty": 1, "unitCost": 150, "total": 150},
    {"item": "Caulk & supplies", "qty": 1, "unitCost": 20, "total": 20}
  ],
  "travel": 35,
  "overhead": 27,
  "profitMargin": 0.30,
  "estimates": {"low": 350, "expected": 450, "high": 550},
  "confidence": 0.85,
  "flagsAndRisks": ["Check water pressure after install", "Old sink may have corrosion"],
  "recommendedNextStep": "Send photo of current faucet installation"
}`,
  };

  const messageContent = imageContent.length > 0 
    ? [...imageContent, textContent]
    : [textContent];

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
  // Extract image URLs from uploaded assets
  const imageUrls = uploadedAssets
    .map((asset: any) => asset.url || asset.s3Url)
    .filter((url: any) => !!url);

  // Call the new analyzeProject function
  const analysis = await analyzeProject(
    quote.description,
    imageUrls,
    quote.id
  );

  // Transform to legacy format expected by the API route
  const materialsCost = analysis.materials.reduce(
    (sum: number, m: any) => sum + (m.total || 0),
    0
  );
  const laborCost = analysis.estimatedLabor.hours * analysis.estimatedLabor.rate;
  const subtotal = laborCost + materialsCost + analysis.travel + analysis.overhead;
  const profitAmount = subtotal * analysis.profitMargin;
  const expectedEstimate = Math.round(subtotal + profitAmount);

  return {
    scope: analysis.scope,
    complexity: analysis.complexity,
    estimatedLabor: analysis.estimatedLabor,
    materials: analysis.materials,
    travel: analysis.travel,
    overhead: analysis.overhead,
    profitMargin: analysis.profitMargin,
    lowEstimate: Math.round(expectedEstimate * 0.8),
    expectedEstimate: expectedEstimate,
    highEstimate: Math.round(expectedEstimate * 1.3),
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
