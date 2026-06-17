import Anthropic from "@anthropic-ai/sdk";
import { getObjectBytes } from "@/lib/s3";

// Image types Claude's vision API accepts.
const VISION_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

// Keep vision payloads sane.
const MAX_VISION_IMAGES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Anthropic per-image limit

interface AnalyzeOptions {
  includePhotos?: boolean;
}

export async function analyzeWithClaude(
  quote: any,
  uploadedAssets: any[],
  options: AnalyzeOptions = {}
): Promise<any> {
  const { includePhotos = false } = options;

  console.log(`[CLAUDE] Starting analysis for quote ${quote.id}`);
  console.log(`[CLAUDE] Category: ${quote.category}`);
  console.log(`[CLAUDE] Assets: ${uploadedAssets.length}, includePhotos: ${includePhotos}`);

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

  // Optionally attach uploaded photos for vision analysis.
  let attachedImages = 0;
  if (includePhotos && Array.isArray(uploadedAssets) && uploadedAssets.length > 0) {
    const imageAssets = uploadedAssets
      .filter((a) => VISION_MIME_TYPES.has(a?.mimeType))
      .slice(0, MAX_VISION_IMAGES);

    for (const asset of imageAssets) {
      try {
        const { buffer, contentType } = await getObjectBytes(asset.s3Url);
        if (buffer.byteLength > MAX_IMAGE_BYTES) {
          console.warn(`[CLAUDE] Skipping ${asset.filename} (too large: ${buffer.byteLength} bytes)`);
          continue;
        }
        const mediaType = VISION_MIME_TYPES.has(contentType)
          ? contentType
          : asset.mimeType;
        messageContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: buffer.toString("base64"),
          },
        });
        attachedImages += 1;
      } catch (imgErr) {
        console.error(
          `[CLAUDE] Failed to load image ${asset?.filename} for vision:`,
          imgErr instanceof Error ? imgErr.message : String(imgErr)
        );
        // Skip this image and continue.
      }
    }
    console.log(`[CLAUDE] Attached ${attachedImages} image(s) for vision analysis`);
  }

  const photoNote =
    attachedImages > 0
      ? `\n\nThe customer attached ${attachedImages} photo(s) of the project, included above. Use them to inform your estimate (assess condition, scope, materials, and complexity from what you can see).`
      : "";

  const prompt = `You are a professional handyman estimator. Analyze this project and provide estimates.

CATEGORY: ${quote.category}
DESCRIPTION: ${quote.description}${photoNote}

Respond with ONLY valid JSON (no markdown):
{"low_estimate": 500, "expected_estimate": 750, "high_estimate": 1200, "complexity": 5, "scope_summary": "work needed", "key_risks": []}`;

  messageContent.push({ type: "text", text: prompt });

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
${(parsed.key_risks || []).map((r: any) => `- ${r}`).join("\n") || "None identified"}

**Photos:** ${attachedImages > 0 ? `${attachedImages} photo(s) analyzed.` : "Analysis based on description only."}`,
      confidence: attachedImages > 0 ? 0.85 : 0.75,
      fullAnalysis: JSON.stringify(parsed, null, 2),
    };
  } catch (error) {
    console.error(`[CLAUDE] ❌ Error:`, error);
    console.error(`[CLAUDE] Error message: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
