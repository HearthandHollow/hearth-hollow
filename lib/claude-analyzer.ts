import Anthropic from "@anthropic-ai/sdk";

export async function analyzeWithClaude(
  quote: any,
  uploadedAssets: any[]
): Promise<any> {
  console.log(`[CLAUDE] Starting analysis for quote ${quote.id}`);
  console.log(`[CLAUDE] Category: ${quote.category}`);
  console.log(`[CLAUDE] Description: ${quote.description.substring(0, 60)}`);

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log(`[CLAUDE] API Key available: ${!!apiKey}`);
  console.log(`[CLAUDE] API Key length: ${apiKey ? apiKey.length : 0}`);

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  // Create client
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

  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: messageContent as any,
        },
      ],
    });

    console.log(`[CLAUDE] Got response from Claude`);

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    console.log(`[CLAUDE] Response length: ${responseText.length}`);
    console.log(`[CLAUDE] First 150 chars: ${responseText.substring(0, 150)}`);

    // Parse JSON - be lenient
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

    console.log(`[CLAUDE] Attempting to parse JSON: ${jsonStr.substring(0, 100)}`);

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
  } catch (error) {
    console.error(`[CLAUDE] Error during analysis:`, error);
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[CLAUDE] Error message: ${msg}`);
    throw error;
  }
}
// Deployed with valid API key
