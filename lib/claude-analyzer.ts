import Anthropic from "@anthropic-ai/sdk";

console.log("[Init] Claude API Key available:", !!process.env.ANTHROPIC_API_KEY);

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeWithClaude(
  quote: any,
  uploadedAssets: any[]
): Promise<any> {
  console.log(`\n[ANALYZE] Starting analysis for quote ${quote.id}`);
  console.log(`[ANALYZE] Category: ${quote.category}`);
  console.log(`[ANALYZE] Description: ${quote.description.substring(0, 60)}`);
  console.log(`[ANALYZE] Assets: ${uploadedAssets.length}`);

  // Build the message
  const messageContent: any[] = [];

  // Add images if available
  if (uploadedAssets && uploadedAssets.length > 0) {
    for (const asset of uploadedAssets) {
      const imageUrl = asset.url || asset.s3Url;
      if (imageUrl && typeof imageUrl === "string") {
        console.log(`[ANALYZE] Adding image: ${imageUrl.substring(0, 50)}`);
        messageContent.push({
          type: "image",
          source: {
            type: "url",
            url: imageUrl,
          },
        });
      }
    }
  }

  // Add text prompt
  const prompt = `You are a professional handyman estimator with 15+ years of experience.

Analyze this project request and provide specific cost estimates.

**CATEGORY:** ${quote.category}
**DESCRIPTION:** ${quote.description}

Respond with ONLY this JSON structure (no markdown, no explanation):
{
  "low_estimate": <integer dollar amount>,
  "expected_estimate": <integer dollar amount>,
  "high_estimate": <integer dollar amount>,
  "complexity": <1-10>,
  "scope_summary": "<what will be done>",
  "key_risks": ["<specific risk>"]
}

Example format:
{"low_estimate": 450, "expected_estimate": 650, "high_estimate": 950, "complexity": 5, "scope_summary": "Build custom dining table from reclaimed wood", "key_risks": ["Wood sourcing may add 1-2 weeks", "Finish quality varies by available materials"]}`;

  messageContent.push({
    type: "text",
    text: prompt,
  });

  console.log(`[ANALYZE] Calling Claude API with ${messageContent.length} content blocks`);

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

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    console.log(`[ANALYZE] Claude response (first 200 chars):`);
    console.log(`[ANALYZE] ${responseText.substring(0, 200)}`);

    // Parse the JSON
    let jsonStr = responseText.trim();

    // Remove markdown code blocks if present
    if (jsonStr.includes("```json")) {
      jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    } else if (jsonStr.includes("```")) {
      jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }

    // Extract JSON object
    const jsonStart = jsonStr.indexOf("{");
    const jsonEnd = jsonStr.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error(`[ANALYZE] ERROR: No JSON found in response`);
      console.error(`[ANALYZE] Full response: ${responseText}`);
      throw new Error("Claude did not return valid JSON");
    }

    jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonStr);

    console.log(`[ANALYZE] Parsed estimates:`);
    console.log(`[ANALYZE]   Low: $${parsed.low_estimate}`);
    console.log(`[ANALYZE]   Expected: $${parsed.expected_estimate}`);
    console.log(`[ANALYZE]   High: $${parsed.high_estimate}`);
    console.log(`[ANALYZE]   Complexity: ${parsed.complexity}`);

    // Validate we got numbers
    const low = parseInt(parsed.low_estimate);
    const expected = parseInt(parsed.expected_estimate);
    const high = parseInt(parsed.high_estimate);

    if (isNaN(low) || isNaN(expected) || isNaN(high)) {
      console.error(`[ANALYZE] ERROR: Estimates are not valid numbers`);
      throw new Error("Invalid estimate values");
    }

    // Return in legacy format
    return {
      lowEstimate: low,
      expectedEstimate: expected,
      highEstimate: high,
      complexity: parsed.complexity || 5,
      scope: parsed.scope_summary || quote.description.substring(0, 100),
      breakdown: `
**Project:** ${quote.category}
**Description:** ${quote.description}

**Complexity:** ${parsed.complexity || 5}/10

**Estimates:**
- Low: $${low}
- Expected: $${expected}
- High: $${high}

**Key Risks:**
${(parsed.key_risks || []).map((r: string) => `- ${r}`).join("\n") || "None identified"}

**Recommendation:** Review estimate and contact customer for confirmation.`,
      confidence: 0.8,
      fullAnalysis: JSON.stringify(parsed, null, 2),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ANALYZE] ERROR: ${errorMessage}`);
    console.error(`[ANALYZE] Stack:`, error instanceof Error ? error.stack : "");

    throw error; // Let the route handler catch this
  }
}
