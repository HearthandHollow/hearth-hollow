// Single source of truth for the estimator prompt and pricing baseline.
//
// Used by BOTH estimate paths so they price the same way:
//   - lib/claude-analyzer.ts (Anthropic API, behind QUOTE_ANALYSIS_API_ENABLED)
//   - /api/brain/quotes/[id] hands this text to Brain (Claude Code on Hunter's
//     subscription), which applies it itself when Hunter asks for a draft.
// Change pricing HERE, not in either caller.

export function isWebDevCategory(category: string | null | undefined): boolean {
  return /website|web\s*&?\s*app|app development|software/i.test(category || "");
}

// Handyman pricing formula, as documented in README.md ("Labor Cost = Hours x
// $60/hour ... Expected = Subtotal x 1.40 ... High = Expected x 1.15").
export const HANDYMAN_PRICING = {
  laborRatePerHour: 60,
  materialMarkup: 0.25,
  travelFlat: 35,
  expectedMultiplier: 1.4,
  highMultiplier: 1.15,
} as const;

// Web/app studio pricing guide (same numbers as the API prompt below).
export const WEBDEV_PRICING_GUIDE =
  "Pricing guide: blended rate $85/hour. Typical ranges — brochure site 4–6 pages $1,200–2,500; site + online scheduling/booking $2,500–4,500; customer or staff portal with logins $4,000–9,000; Stripe payments/invoicing add $800–2,000; cross-platform mobile app MVP $8,000–20,000; AI voice/quote agent $1,500–4,000. Adjust for integrations, content volume, and design complexity.";

export function handymanPricingText(): string {
  const p = HANDYMAN_PRICING;
  return [
    `Labor cost = hours x $${p.laborRatePerHour}/hour`,
    `Material cost = estimated materials x ${1 + p.materialMarkup} (${Math.round(p.materialMarkup * 100)}% markup)`,
    `Travel = $${p.travelFlat} flat`,
    `Subtotal = labor + materials + travel`,
    `Low = subtotal; Expected = subtotal x ${p.expectedMultiplier}; High = expected x ${p.highMultiplier}`,
  ].join("\n");
}

// The exact prompt the API analyzer has always sent (kept byte-for-byte so the
// API path's behaviour is unchanged by this refactor).
export function buildEstimatorPrompt(quote: { category: string; description: string }, photoNote = ""): string {
  if (isWebDevCategory(quote.category)) {
    return `You are a senior estimator for a small web and mobile app development studio (The Hearth & Hollow, Salisbury NC) that builds Next.js websites, online scheduling, customer/staff portals, Stripe payments, cross-platform mobile apps (Expo/React Native), and AI automation for trades, small practices, and homesteads. Analyze this request and provide a fixed-price estimate for the initial build (excluding the monthly hosting/care plan).

${WEBDEV_PRICING_GUIDE}

CATEGORY: ${quote.category}
DESCRIPTION: ${quote.description}${photoNote}

Respond with ONLY valid JSON (no markdown):
{"low_estimate": 1500, "expected_estimate": 2500, "high_estimate": 4000, "complexity": 5, "scope_summary": "what will be built", "key_risks": [], "material_list": [{"item": "Domain registration (annual)", "quantity": 1, "unit": "year", "estimated_price": 20}]}

For material_list: list third-party costs the customer will pay (domain, hosting/care plan per month, app store developer fees, SMS/telephony, payment processing setup) with realistic current USD prices PER UNIT. Do not list lumber or physical materials.`;
  }
  return `You are a professional handyman estimator. Analyze this project and provide estimates, including a best-effort itemized material list with realistic current US retail prices and quantities.

CATEGORY: ${quote.category}
DESCRIPTION: ${quote.description}${photoNote}

Respond with ONLY valid JSON (no markdown):
{"low_estimate": 500, "expected_estimate": 750, "high_estimate": 1200, "complexity": 5, "scope_summary": "work needed", "key_risks": [], "material_list": [{"item": "2x4x8 pressure-treated lumber", "quantity": 12, "unit": "board", "estimated_price": 6.50}]}

For material_list: estimate every material likely needed for this specific project to the best of your ability given the description (and photos, if provided). "estimated_price" is the price PER UNIT in USD. If you genuinely cannot estimate any materials (e.g. pure labor task), return an empty array.`;
}

// Extra instructions for a Brain draft: same estimator, plus the documented
// pricing formula and the richer fields Hunter reviews before anything is sent.
export function brainDraftInstructions(quote: { category: string }): string {
  const pricing = isWebDevCategory(quote.category)
    ? WEBDEV_PRICING_GUIDE
    : `Apply the house pricing formula exactly:\n${handymanPricingText()}`;
  return `Look at every attached photo yourself before estimating. ${pricing}

Return ONE JSON object (no markdown) with the estimator fields above PLUS:
{"labor_hours": 6, "line_items": [{"description": "Remove and dispose of rotted deck boards", "hours": 2, "amount": 120}], "assumptions": ["..."], "questions_for_customer": ["..."], "confidence": 0.7}
- line_items: the labor/work breakdown; amounts in USD.
- material_list prices are PER UNIT before markup.
- low/expected/high must follow the formula from labor_hours, materials and travel.
- confidence 0..1: lower it when photos are missing, unclear, or scope is ambiguous.
- questions_for_customer: what you'd need answered to firm up the price.
Never invent prices outside this guidance.`;
}
