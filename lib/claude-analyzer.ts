import Anthropic from "@anthropic-ai/sdk";

export async function analyzeWithClaude(
  quote: any,
  uploadedAssets: any[]
): Promise<any> {
  console.log(`[CLAUDE] Starting analysis for quote ${quote.id}`);
  console.log(`[CLAUDE] Category: ${quote.category}`);

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
  }

  const prompt = `You are a professional handyman estimator. Analyze this project and provide estimates.

CATEGORY: ${quote.category}
DESCRIPTION: ${quote.description}

Respond with ONLY valid JSON (no markdown):
{"low_estimate": 500, "expected_estimate": 750, "high_estimate": 1200, "complexity": 5, "scope_summary": "work needed", "key_risks": []}`;

  messageContent.push({
    type: "text",
    text: prompt,
  });

  try {
    const response = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
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

    const parsed = JSON.parse(jsonStr);

    const low = parseInt(parsed.low_estimate) || 500;
    const expected = parseInt(parsed.expected_estimate) || 750;
    const high = parseInt(parsed.high_estimate) || 1200;

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
    console.error(`[CLAUDE] Error:`, error);
    throw error;
  }
}
