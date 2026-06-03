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
  imageUrls: string[]
): Promise<ProjectAnalysis> {
  // Build message with vision
  const imageContent = imageUrls.map(url => ({
    type: "image" as const,
    source: {
      type: "url" as const,
      url,
    },
  }));

  const textContent = {
    type: "text" as const,
    text: `You are an expert handyman and project estimator with 15+ years of experience. 
    
Analyze this handyman project request and provide a detailed cost estimate.

PROJECT DESCRIPTION:
${description}

Based on the provided images and description, generate a JSON response with:
1. Scope: Clear summary of what needs to be done
2. Complexity: Rate 1-10 (1=trivial, 10=extremely complex)
3. EstimatedLabor: hours and hourly rate (use $50-75/hr for starter rates)
4. Materials: Array of items with quantities and costs
5. Travel: Flat fee or mileage estimate
6. Overhead: 15% of subtotal for business costs
7. ProfitMargin: 0.25-0.35 (25-35% recommended)
8. Estimates: low, expected, high based on unknowns
9. Confidence: 0-1 score based on photo clarity and description detail
10. FlagsAndRisks: Array of concerns or unknowns
11. RecommendedNextStep: What to do next (site visit, clarification, etc)

Respond with ONLY valid JSON matching this structure.`,
  };

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [...imageContent, textContent],
      },
    ],
  });

  // Extract JSON from response
  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON - handle markdown code blocks
  let jsonStr = responseText;
  if (responseText.includes("```json")) {
    jsonStr = responseText.split("```json")[1].split("```")[0];
  } else if (responseText.includes("```")) {
    jsonStr = responseText.split("```")[1].split("```")[0];
  }

  const parsed = JSON.parse(jsonStr.trim());

  return {
    scope: parsed.scope || "",
    complexity: parsed.complexity || 5,
    estimatedLabor: parsed.estimatedLabor || { hours: 8, rate: 60 },
    materials: parsed.materials || [],
    travel: parsed.travel || 35,
    overhead: parsed.overhead || 100,
    profitMargin: parsed.profitMargin || 0.3,
    estimates: parsed.estimates || { low: 1000, expected: 1200, high: 1400 },
    confidence: parsed.confidence || 0.5,
    flagsAndRisks: parsed.flagsAndRisks || [],
    recommendedNextStep: parsed.recommendedNextStep || "Schedule site visit",
  };
}
