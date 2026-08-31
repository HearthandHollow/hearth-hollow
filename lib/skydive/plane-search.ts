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

// This deployment routes Anthropic calls through a proxy (LiteLLM) whose
// model list is limited, so we try candidates in order and fall back when a
// model name is rejected. SKYDIVE_PLANE_SEARCH_MODEL pins the first choice.
const MODEL_CANDIDATES = [
  process.env.SKYDIVE_PLANE_SEARCH_MODEL,
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "claude-haiku-4-5",
].filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i);

const MAX_SEARCHES = 10;

// Newer models take the dynamic-filtering web-search variant; older ones
// (haiku, pre-4.6) only accept the basic variant. If the preferred variant is
// rejected we retry the same model with the basic one.
function webSearchVariants(model: string): string[] {
  const modern = /opus-5|opus-4-[678]|sonnet-5|sonnet-4-6|fable-5/.test(model);
  return modern
    ? ["web_search_20260209", "web_search_20250305"]
    : ["web_search_20250305"];
}

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
  /** Direct photo URL from the listing, when the model found one. */
  imageUrl: string;
  /** True when url was replaced with a marketplace search (dead/untrusted link). */
  linkIsSearch?: boolean;
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
  /** How many live web searches actually ran — 0 means unresearched output. */
  searchesRun?: number;
  modelUsed?: string;
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
      "imageUrl": "direct https URL of a photo of THIS aircraft from the listing page if you saw one, else \\"\\"",
      "importCost": null
    }
  ],
  "sites": [ { "name": "Controller", "url": "https://controller.com", "bestFor": "largest US turbine inventory" } ],
  "cautions": "honest caveats: pre-buy inspection, jump-door STC, Part 91 vs 119, anything you could not verify"
}
- "importCost" is null for US-located aircraft; for overseas aircraft use {"applicable": true, "breakdown": "itemized estimate", "estimatedTotal": "$X-Y"}.
- No text after the closing fence.
- If your web search tool is unavailable, fails, or returns nothing usable: return an empty "options" array and explain in "cautions" — NEVER output example, placeholder, or remembered listings or URLs as if they were real.`;

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

/**
 * Pull the result JSON out of the model's reply: prefer the last ```json
 * fence, but fall back to bare JSON (some models skip the fence) by slicing
 * from the first "{" to the last "}".
 */
export function extractJson(text: string): PlaneSearchResult | null {
  const fences = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  const candidates: string[] = [];
  const last = fences[fences.length - 1];
  if (last) candidates.push(last[1]);
  const open = text.indexOf("{");
  const close = text.lastIndexOf("}");
  if (open !== -1 && close > open) candidates.push(text.slice(open, close + 1));

  for (const candidate of candidates) {
    const parsed = tryParse(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function tryParse(json: string): PlaneSearchResult | null {
  try {
    const parsed = JSON.parse(json);
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
        imageUrl: /^https:\/\//.test(String(o?.imageUrl || "")) ? String(o.imageUrl) : "",
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

async function attempt(
  input: PlaneSearchInput,
  model: string,
  toolType: string
): Promise<PlaneSearchResult> {
  const response = await client.messages.create(
    {
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
      tools: [
        {
          type: toolType,
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

  const blocks = response.content as any[];
  const text = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  // How many live searches actually happened — zero means the "research" is
  // unverified model output and the UI should say so loudly.
  const searchesRun = blocks.filter(
    (b) => b.type === "web_search_tool_result"
  ).length;

  const parsed = extractJson(text);
  if (parsed) return { ...parsed, searchesRun, modelUsed: model };

  // Parsing failed — surface the raw research text rather than nothing.
  return {
    summary: "",
    options: [],
    sites: [],
    cautions: "",
    raw: text.replace(/```json[\s\S]*?```/g, "").trim(),
    searchesRun,
    modelUsed: model,
  };
}

// --- Listing-link verification ----------------------------------------------
// Models sometimes emit stale or fabricated listing URLs (especially if the
// web-search tool didn't actually run). Verify each URL server-side and swap
// dead/untrusted ones for a live marketplace search for that aircraft.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function marketplaceSearchUrl(o: PlaneOption): string {
  const model = o.name.replace(/^(19|20)\d{2}\s*/, "").trim();
  const q = encodeURIComponent(model);
  const s = (o.source || "").toLowerCase();
  if (s.includes("trade"))
    return `https://www.trade-a-plane.com/search?s-type=aircraft&keyword=${q}`;
  if (s.includes("controller"))
    return `https://www.controller.com/listings/search?keywords=${q}`;
  return `https://www.google.com/search?q=${encodeURIComponent(
    `"${model}" for sale ${o.source || ""}`.trim()
  )}`;
}

async function verifyOptionLinks(
  options: PlaneOption[],
  searchesRun: number
): Promise<void> {
  await Promise.all(
    options.map(async (o) => {
      const downgrade = () => {
        o.url = marketplaceSearchUrl(o);
        o.linkIsSearch = true;
      };
      // No live search ran -> the model can't have actually seen this URL.
      if (!o.url || searchesRun === 0) return downgrade();
      try {
        const res = await fetch(o.url, {
          redirect: "follow",
          headers: { "User-Agent": BROWSER_UA },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 404 || res.status === 410) return downgrade();
        // Barnstormers serves its not-found page with a 200.
        if (res.ok && /barnstormers\.com/i.test(o.url)) {
          const body = await res.text();
          if (/can't seem to find the page/i.test(body)) return downgrade();
        }
        // 403/405/429 are bot-blocks, not dead links — keep the URL.
      } catch {
        return downgrade(); // unreachable host / timeout
      }
    })
  );
}

export async function searchPlanes(
  input: PlaneSearchInput
): Promise<PlaneSearchResult> {
  let lastError: unknown = null;

  for (const model of MODEL_CANDIDATES) {
    for (const toolType of webSearchVariants(model)) {
      try {
        const result = await attempt(input, model, toolType);
        console.log(
          `Plane search succeeded with model=${model} tool=${toolType} searches=${result.searchesRun}`
        );
        if (result.options.length) {
          await verifyOptionLinks(result.options, result.searchesRun ?? 0);
        }
        return result;
      } catch (error: any) {
        lastError = error;
        // 400s from the API/proxy: an unknown model name -> try the next
        // model; an unsupported tool variant -> try the basic variant.
        const msg = String(error?.message || "");
        const isBadRequest =
          error instanceof Anthropic.BadRequestError || error?.status === 400;
        if (!isBadRequest) throw error;
        if (/web_search|tool/i.test(msg)) {
          console.warn(`Plane search: ${model} rejected tool ${toolType}, trying next variant`);
          continue;
        }
        if (/model/i.test(msg)) {
          console.warn(`Plane search: model ${model} rejected by API/proxy, trying next`);
          break;
        }
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No available model could run the search.");
}
