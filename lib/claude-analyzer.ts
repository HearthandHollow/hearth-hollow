import Anthropic from "@anthropic-ai/sdk";

export async function analyzeWithClaude(
  quote: any,
  uploadedAssets: any[]
): Promise<any> {
  console.log(`[CLAUDE] Starting analysis for quote ${quote.id}`);
  console.log(`[CLAUDE] Category: ${quote.category}`);
  console.log(`[CLAUDE] Assets: ${uploadedAssets.length}`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  let client: Anthropic;
  try {
    client = new Anthropic({ apiKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to create Anthropic client: ${msg}`);
  }

  const messageContent: any[] = [];

  // Process images
  let validImageCount = 0;
  if (uploadedAssets && uploadedAssets.length > 0) {
    for (const asset of uploadedAssets) {
      const imageUrl = asset.url || asset.s3Url;
      console.log(`[CLAUDE] Asset: url=${!!asset.url}, s3Url=${!!asset.s3Url}, mimeType=${asset.mimeType}`);
      
      if (imageUrl && typeof imageUrl === "string") {
        // Only add image if it's a supported format
        if (asset.mimeType && asset.mimeType.startsWith('image/')) {
          console.log(`[CLAUDE] Adding image: ${imageUrl.substring(0, 80)}`);
          messageContent.push({
            type: "image",
            source: {
              type: "url",
              url: imageUrl,
            },
          });
          validImageCount++;
        } else {
          console.warn(`[CLAUDE] Skipping unsupported file type: ${asset.mimeType}`);
        }
      }
    }
  }

  console.log(`[CLAUDE] Valid images: ${validImageCount}`);

  const prompt = `You are a professional handyman estimator. Analyze this project and provide estimates.

CATEGORY: ${quote.category}
DESCRIPTION: ${quote.description}

Respond with ONLY valid JSON (no markdown):
{"low_estimate": 500, "expected_estimate": 750, "high_estimate": 1200, "complexity": 5, "scope_summary": "work needed", "key_risks": []}`;

  messageContent.push({
    type: "text",
    text: prompt,
  });

  console.log(`[CLAUDE] Message content blocks: ${messageContent.length}`);

  try {
    console.log(`[CLAUDE] Calling Claude API...`);
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: messageContent as any,
        },
      ],
    });

    console.log(`[CLAUDE] ✅ Response received`);

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    console.log(`[CLAUDE] Response: ${responseText.substring(0, 200)}`);

    let jsonStr = responseText.trim();

    if (jsonStr.startsWith("```")) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonStr = match[1];
      }
    }

    const jsonStart = jsonStr.indexOf("{");
    const jsonEnd = jsonStr.lastIndexOf("}");

    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
    }

    console.log(`[CLAUDE] Parsing JSON...`);
    const parsed = JSON.parse(jsonStr);
    console.log(`[CLAUDE] ✅ JSON parsed`);

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
  } catch (error) {
    console.error(`[CLAUDE] ❌ Error:`, error);
    console.error(`[CLAUDE] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    console.error(`[CLAUDE] Error message: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
