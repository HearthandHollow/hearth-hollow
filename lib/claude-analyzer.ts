import Anthropic from "@anthropic-ai/sdk";

export async function analyzeWithClaude(
  quote: any,
  uploadedAssets: any[]
): Promise<any> {
  console.log(`[CLAUDE] Starting analysis for quote ${quote.id}`);
  console.log(`[CLAUDE] Category: ${quote.category}`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log(`[CLAUDE] API Key available: ${!!apiKey}`);

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  let client: Anthropic;
  try {
    client = new Anthropic({ apiKey });
    console.log(`[CLAUDE] Anthropic client created`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[CLAUDE] Failed to create Anthropic client: ${msg}`);
    throw err;
  }

  // Build the message
  const messageContent: any[] = [];

  // Add images if available
  if (uploadedAssets && uploadedAssets.length > 0) {
    for (const asset of uploadedAssets) {
      const imageUrl = asset.url || asset.s3Url;
      if (imageUrl && typeof imageUrl === "string") {
        messageContent.push({
          type: "image",
          source: {
            type: "url",
            url: imageUrl,
          },
        });
      }
    }
    console.log(`[CLAUDE] Added ${messageContent.length} images`);
  }

  // Add text prompt
  const prompt = `You are a professional handyman estimator. Analyze this project and provide estimates.

CATEGORY: ${quote.category}
DESCRIPTION: ${quote.description}

Respond with ONLY valid JSON (no markdown):
{"low_estimate": 500, "expected_estimate": 750, "high_estimate": 1200, "complexity": 5, "scope_summary": "work needed", "key_risks": []}`;

  messageContent.push({
    type: "text",
    text: prompt,
  });

  console.log(`[CLAUDE] Calling Claude API...`);

  // Try primary model, fallback to secondary if needed
  const models = ["claude-3-5-sonnet-20241022", "claude-3-sonnet-20240229"];
  
  for (const model of models) {
    try {
      console.log(`[CLAUDE] Attempting with model: ${model}`);
      
      const response = await client.messages.create({
        model: model as any,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: messageContent as any,
          },
        ],
      });

      console.log(`[CLAUDE] Success with model: ${model}`);

      const responseText =
        response.content[0].type === "text" ? response.content[0].text : "";

      console.log(`[CLAUDE] Response length: ${responseText.length}`);

      // Parse JSON
      let jsonStr = responseText.trim();

      // Remove markdown
      if (jsonStr.startsWith("```")) {
        const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonStr = match[1];
        }
      }

      // Extract JSON
      const jsonStart = jsonStr.indexOf("{");
      const jsonEnd = jsonStr.lastIndexOf("}");

      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }

      const parsed = JSON.parse(jsonStr);
      console.log(`[CLAUDE] Successfully parsed JSON`);

      const low = parseInt(parsed.low_estimate) || 500;
      const expected = parseInt(parsed.expected_estimate) || 750;
      const high = parseInt(parsed.high_estimate) || 1200;

      console.log(`[CLAUDE] Estimates: Low=$${low}, Expected=$${expected}, High=$${high}`);

      return {
        lowEstimate: low,
        expectedEstimate: expected,
        highEstimate: high,
        complexity: parsed.complexity || 5,
        scope: parsed.scope_summary || "Project analysis",
        breakdown: `
**Project:** ${quote.category}
**Description:** ${quote.description}

**Complexity:** ${parsed.complexity || 5}/10

**Estimates:**
- Low: $${low}
- Expected: $${expected}
- High: $${high}

**Key Risks:**
${(parsed.key_risks || []).map((r: any) => `- ${r}`).join("\n") || "None identified"}`,
        confidence: 0.75,
        fullAnalysis: JSON.stringify(parsed, null, 2),
      };
    } catch (error: any) {
      console.error(`[CLAUDE] Error with model ${model}:`, error.message);
      
      // Check if it's a model not found error
      if (error.status === 404 || (error.error?.type === "not_found_error")) {
        console.log(`[CLAUDE] Model ${model} not available, trying next...`);
        continue;
      }
      
      // If it's the last model, throw the error
      if (model === models[models.length - 1]) {
        console.error(`[CLAUDE] All models failed`);
        throw error;
      }
    }
  }
  
  throw new Error("Could not analyze with any available model");
}
