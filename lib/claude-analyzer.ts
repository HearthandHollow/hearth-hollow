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

  const isWebDev = /website|web\s*&?\s*app|app development|software/i.test(quote.category);

  const prompt = isWebDev
    ? `You are a senior estimator for a small web and mobile app development studio (The Hearth & Hollow, Salisbury NC) that builds Next.js websites, online scheduling, customer/staff portals, Stripe payments, cross-platform mobile apps (Expo/React Native), and AI automation for trades, small practices, and homesteads. Analyze this request and provide a fixed-price estimate for the initial build (excluding the monthly hosting/care plan).

Pricing guide: blended rate $85/hour. Typical ranges — brochure site 4–6 pages $1,200–2,500; site + online scheduling/booking $2,500–4,500; customer or staff portal with logins $4,000–9,000; Stripe payments/invoicing add $800–2,000; cross-platform mobile app MVP $8,000–20,000; AI voice/quote agent $1,500–4,000. Adjust for integrations, content volume, and design complexity.

CATEGORY: ${quote.category}
DESCRIPTION: ${quote.description}${photoNote}

Respond with ONLY valid JSON (no markdown):
{"low_estimate": 1500, "expected_estimate": 2500, "high_estimate": 4000, "complexity": 5, "scope_summary": "what will be built", "key_risks": [], "material_list": [{"item": "Domain registration (annual)", "quantity": 1, "unit": "year", "estimated_price": 20}]}

For material_list: list third-party costs the customer will pay (domain, hosting/care plan per month, app store developer fees, SMS/telephony, payment processing setup) with realistic current USD prices PER UNIT. Do not list lumber or physical materials.`
    : `You are a professional handyman estimator. Analyze this project and provide estimates, including a best-effort itemized material list with realistic current US retail prices and quantities.

CATEGORY: ${quote.category}
DESCRIPTION: ${quote.description}${photoNote}

Respond with ONLY valid JSON (no markdown):
{"low_estimate": 500, "expected_estimate": 750, "high_estimate": 1200, "complexity": 5, "scope_summary": "work needed", "key_risks": [], "material_list": [{"item": "2x4x8 pressure-treated lumber", "quantity": 12, "unit": "board", "estimated_price": 6.50}]}

For material_list: estimate every material likely needed for this specific project to the best of your ability given the description (and photos, if provided). "estimated_price" is the price PER UNIT in USD. If you genuinely cannot estimate any materials (e.g. pure labor task), return an empty array.`;

  messageContent.push({ type: "text", text: prompt });

  try {
    console.log(`[CLAUDE] Calling Claude API...`);
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
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

    const materialList = Array.isArray(parsed.material_list)
      ? parsed.material_list
          .map((m: any) => ({
            item: String(m?.item || "").trim(),
            quantity: Number(m?.quantity) || 1,
            unit: String(m?.unit || "unit").trim(),
            estimatedPrice: Number(m?.estimated_price) || 0,
          }))
          .filter((m: any) => m.item.length > 0)
      : [];

    console.log(`[CLAUDE] Estimates: Low=$${low}, Expected=$${expected}, High=$${high}, Materials=${materialList.length}`);

    const materialLines = materialList.length
      ? materialList
          .map(
            (m: any) =>
              `- ${m.item}: ${m.quantity} ${m.unit} @ $${m.estimatedPrice.toFixed(2)} = $${(m.quantity * m.estimatedPrice).toFixed(2)}`
          )
          .join("\n")
      : "None estimated";

    return {
      lowEstimate: low,
      expectedEstimate: expected,
      highEstimate: high,
      complexity: parsed.complexity || 5,
      scope: parsed.scope_summary || "Project analysis",
      materialList,
      breakdown: `
**Project:** ${quote.category}
**Description:** ${quote.description}

**Complexity:** ${parsed.complexity || 5}/10

**Estimates:**
- Low: $${low}
- Expected: $${expected}
- High: $${high}

**Estimated Materials:**
${materialLines}

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
