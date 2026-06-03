import Anthropic from "@anthropic-ai/sdk";

console.log("[INIT] Claude Analyzer loaded");
console.log("[INIT] API Key available:", !!process.env.ANTHROPIC_API_KEY);
if (process.env.ANTHROPIC_API_KEY) {
  console.log("[INIT] API Key length:", process.env.ANTHROPIC_API_KEY.length);
  console.log("[INIT] API Key starts with:", process.env.ANTHROPIC_API_KEY.substring(0, 10));
}

let client: Anthropic | null = null;

try {
  client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log("[INIT] ✅ Anthropic client created successfully");
} catch (error) {
  console.error("[INIT] ❌ Failed to create Anthropic client:", error);
}

export async function analyzeWithClaude(
  quote: any,
  uploadedAssets: any[]
): Promise<any> {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`[CLAUDE] Starting analysis for quote ${quote.id}`);
  console.log(`[CLAUDE] Category: ${quote.category}`);
  console.log(`[CLAUDE] Description: ${quote.description.substring(0, 80)}`);
  console.log(`[CLAUDE] Assets: ${uploadedAssets.length}`);
  console.log(`[CLAUDE] Client initialized: ${!!client}`);
  console.log("=".repeat(80));

  if (!client) {
    throw new Error(
      "Anthropic client not initialized - ANTHROPIC_API_KEY not set in environment"
    );
  }

  // Build the message
  const messageContent: any[] = [];

  // Add images if available
  if (uploadedAssets && uploadedAssets.length > 0) {
    console.log(`[CLAUDE] Processing ${uploadedAssets.length} assets...`);
    for (let i = 0; i < uploadedAssets.length; i++) {
      const asset = uploadedAssets[i];
      const imageUrl = asset.url || asset.s3Url;
      console.log(
        `[CLAUDE] Asset ${i}: url=${!!asset.url}, s3Url=${!!asset.s3Url}`
      );
      if (imageUrl && typeof imageUrl === "string") {
        console.log(`[CLAUDE] ✅ Adding image ${i}: ${imageUrl.substring(0, 60)}`);
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

Respond with ONLY this JSON structure (no markdown, no explanation, no other text):
{
  "low_estimate": <integer dollar amount>,
  "expected_estimate": <integer dollar amount>,
  "high_estimate": <integer dollar amount>,
  "complexity": <1-10>,
  "scope_summary": "<what will be done>",
  "key_risks": ["<specific risk>"]
}

Example:
{"low_estimate": 450, "expected_estimate": 650, "high_estimate": 950, "complexity": 5, "scope_summary": "Build custom dining table", "key_risks": ["Wood sourcing delays"]}`;

  messageContent.push({
    type: "text",
    text: prompt,
  });

  console.log(`[CLAUDE] Sending request with ${messageContent.length} content blocks`);
  console.log(`[CLAUDE] Prompt length: ${prompt.length} characters`);

  try {
    console.log(`[CLAUDE] Calling client.messages.create...`);
    
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

    console.log(`[CLAUDE] ✅ Response received`);
    console.log(`[CLAUDE] Response type: ${response.content[0].type}`);

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    console.log(`[CLAUDE] Response text length: ${responseText.length}`);
    console.log(`[CLAUDE] First 300 chars: ${responseText.substring(0, 300)}`);

    // Parse the JSON
    let jsonStr = responseText.trim();

    // Remove markdown code blocks if present
    if (jsonStr.includes("```json")) {
      console.log("[CLAUDE] Removing markdown json code block");
      jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    } else if (jsonStr.includes("```")) {
      console.log("[CLAUDE] Removing markdown code block");
      jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }

    // Extract JSON object
    const jsonStart = jsonStr.indexOf("{");
    const jsonEnd = jsonStr.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error(`[CLAUDE] ❌ No JSON object found in response`);
      console.error(`[CLAUDE] Full response: ${responseText}`);
      throw new Error("Claude did not return valid JSON");
    }

    jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
    console.log(`[CLAUDE] Extracted JSON (first 200 chars): ${jsonStr.substring(0, 200)}`);

    const parsed = JSON.parse(jsonStr);
    console.log(`[CLAUDE] ✅ JSON parsed successfully`);

    const low = parseInt(parsed.low_estimate);
    const expected = parseInt(parsed.expected_estimate);
    const high = parseInt(parsed.high_estimate);

    console.log(`[CLAUDE] Parsed values:`);
    console.log(`[CLAUDE]   low: ${low} (parsed from ${parsed.low_estimate})`);
    console.log(
      `[CLAUDE]   expected: ${expected} (parsed from ${parsed.expected_estimate})`
    );
    console.log(`[CLAUDE]   high: ${high} (parsed from ${parsed.high_estimate})`);

    if (isNaN(low) || isNaN(expected) || isNaN(high)) {
      console.error(
        `[CLAUDE] ❌ Estimates are not valid numbers: low=${low}, expected=${expected}, high=${high}`
      );
      throw new Error("Invalid estimate values from Claude");
    }

    console.log(
      `[CLAUDE] ✅ All estimates valid: $${low} - $${expected} - $${high}`
    );

    // Return in legacy format
    const result = {
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

    console.log(`[CLAUDE] ✅ Returning result object`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.constructor.name : typeof error;

    console.error(`[CLAUDE] ❌ ANALYSIS FAILED`);
    console.error(`[CLAUDE] Error type: ${errorType}`);
    console.error(`[CLAUDE] Error message: ${errorMessage}`);

    if (error instanceof Error && error.stack) {
      console.error(`[CLAUDE] Stack trace:`);
      console.error(error.stack);
    }

    // Log full error object
    console.error(`[CLAUDE] Full error object:`, JSON.stringify(error, null, 2));

    throw error;
  }
}
