import Anthropic from "@anthropic-ai/sdk";

/**
 * AI-powered jump-plane research for the Skydive Weather site. Takes a user's
 * guidelines (buy vs lease, budget, capacity, class, region) and runs a live
 * web-research pass with Claude + the server-side web-search tool across the
 * major aircraft marketplaces, returning a few concrete options with history,
 * an import-cost estimate for overseas listings, and a where-to-search guide.
 *
 * Each search costs real API money (web-search surcharge + tokens), so the
 * API route in front of this rate-limits per user and per IP.
 */

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Overridable so the model (and cost) can be tuned without a code change.
const MODEL = process.env.SKYDIVE_PLANE_SEARCH_MODEL || "claude-opus-5";
const MAX_SEARCHES = 10;

export interface PlaneSearchInput {
  intent: "buy" | "lease";
  budget: string; // free text, e.g. "$450k max" or "$8k/mo"
  capacity: string; // jumpers, e.g. "4", "8-10", "15+"
  aircraftClass: string; // "any" | "piston single" | "turbine single" | "twin turbine"
  region: string; // "US only" | "North America" | "Worldwide"
  notes: string;
}

export interface PlaneOption {
  name: string;
  price: string;
  year: string;
  location: string;
  url: string;
  source: string;
  details: string;
  history: string;
  importCost: {
    applicable: boolean;
    breakdown: string;
    estimatedTotal: string;
  } | null;
}

export interface PlaneSearchResult {
  summary: string;
  options: PlaneOption[];
  sites: { name: string; url: string; bestFor: string }[];
  cautions: string;
  /** Raw model text, kept as a fallback when JSON parsing fails. */
  raw?: string;
}

const SYSTEM_PROMPT = `You are an aircraft-acquisition researcher helping skydivers and dropzone operators find jump planes. You research CURRENT, REAL listings using web search — never invent listings.

Search strategy (do a real deep dive, multiple searches):
- Sale marketplaces: controller.com, trade-a-plane.com, aso.com, globalair.com, aircraft.com, barnstormers.com, avbuyer.com
- Overseas: planecheck.com (Europe), avbuyer international listings
- Lease/rent: aircraft leasing brokers, dropzone/skydiving operator channels (e.g. dropzone.com classifieds), regional aircraft lessors
- Common jump planes to consider by capacity: Cessna 182/206 (piston, ~4 jumpers), Cessna 208 Caravan / PAC 750XL / Kodiak 100 (turbine single, ~14-17), DHC-6 Twin Otter / Short SC-7 Skyvan / Dornier 228 (twin turbine, ~20+)

For each candidate listing, when possible, dig for past details: registration (N-number or foreign reg), engine/airframe times (TTAF, SMOH/TBO), prior accident/incident history (NTSB/FAA or the foreign equivalent), how long it has been listed, prior asking prices. Say plainly when history can't be found.

Import-cost estimate (only for aircraft located outside the United States): civil aircraft imports into the US under HTS 8802 are generally duty-free, so the real costs are logistics and certification. Estimate and itemize: ferry flight (crew, fuel, permits, insurance — or disassembly + container/RORO shipping for smaller aircraft), customs broker and entry fees (~$500-2,000), foreign deregistration + FAA registration (~$100-500), US standard airworthiness certificate via a DAR including any required inspections/mods (~$2,000-10,000 depending on type and paperwork quality), escrow/title search, and a reminder that state sales/use tax typically applies at the buyer's home state rate. Give a realistic total range in USD.

Output rules:
- Recommend 2-4 options that genuinely fit the user's guidelines, with the listing URL you found. If real current listings are scarce, include what you found and say so in "cautions" — do NOT fabricate.
- Also produce a "sites" guide: the best places to search for this specific mission (sale vs lease, US vs overseas), with one line on what each is best for.
- End your reply with ONLY a fenced json block (\`\`\`json ... \`\`\`) matching exactly this shape:
{
  "summary": "2-3 sentence overview of the market for their guidelines",
  "options": [
    {
      "name": "1998 Cessna 208B Grand Caravan",
      "price": "$1,650,000",
      "year": "1998",
      "location": "Florida, USA",
      "url": "https://...",
      "source": "Controller",
      "details": "TTAF, engine times, jump config (door/steps), useful load, why it fits",
      "history": "what you found: times, incidents, listing age — or 'No history found'",
      "importCost": null
    }
  ],
  "sites": [ { "name": "Controller", "url": "https://controller.com", "bestFor": "largest US turbine inventory" } ],
  "cautions": "honest caveats: pre-buy inspection, jump-door STC, Part 91 vs 119, anything you could not verify"
}
- "importCost" is null for US-located aircraft; for overseas aircraft use {"applicable": true, "breakdown": "itemized estimate", "estimatedTotal": "$X-Y"}.
- No text after the closing fence.`;

function buildUserPrompt(input: PlaneSearchInput): string {
  return `Find jump planes matching these guidelines:
- Looking to: ${input.intent === "lease" ? "RENT / LEASE" : "BUY"}
- Budget: ${input.budget || "not specified"}
- Jumper capacity needed: ${input.capacity || "not specified"}
- Aircraft class preference: ${input.aircraftClass || "any"}
- Acceptable location: ${input.region || "US only"}
${input.notes ? `- Additional guidelines: ${input.notes}` : ""}

Today's date context matters — find listings that are current, and note if a listing looks stale.`;
}

/** Pull the last ```json fence out of the model's reply. */
function extractJson(text: string): PlaneSearchResult | null {
  const fences = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  const last = fences[fences.length - 1];
  if (!last) return null;
  try {
    const parsed = JSON.parse(last[1]);
    if (!parsed || !Array.isArray(parsed.options)) return null;
    return {
      summary: String(parsed.summary || ""),
      options: parsed.options.map((o: any) => ({
        name: String(o?.name || "Unknown aircraft"),
        price: String(o?.price || "—"),
        year: String(o?.year || ""),
        location: String(o?.location || ""),
        url: String(o?.url || ""),
        source: String(o?.source || ""),
        details: String(o?.details || ""),
        history: String(o?.history || "No history found"),
        importCost:
          o?.importCost && o.importCost.applicable
            ? {
                applicable: true,
                breakdown: String(o.importCost.breakdown || ""),
                estimatedTotal: String(o.importCost.estimatedTotal || ""),
              }
            : null,
      })),
      sites: Array.isArray(parsed.sites)
        ? parsed.sites.map((s: any) => ({
            name: String(s?.name || ""),
            url: String(s?.url || ""),
            bestFor: String(s?.bestFor || ""),
          }))
        : [],
      cautions: String(parsed.cautions || ""),
    };
  } catch {
    return null;
  }
}

export async function searchPlanes(
  input: PlaneSearchInput
): Promise<PlaneSearchResult> {
  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: MAX_SEARCHES,
        } as any,
      ],
    } as any,
    // Research with many searches can run several minutes.
    { timeout: 9 * 60 * 1000 }
  );

  if ((response as any).stop_reason === "refusal") {
    throw new Error("The research model declined this search. Try rewording your guidelines.");
  }

  const text = (response.content as any[])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const parsed = extractJson(text);
  if (parsed) return parsed;

  // Parsing failed — surface the raw research text rather than nothing.
  return {
    summary: "",
    options: [],
    sites: [],
    cautions: "",
    raw: text.replace(/```json[\s\S]*?```/g, "").trim(),
  };
}
