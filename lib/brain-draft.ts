// Pure validation/formatting for a Brain-written estimate draft (no DB, no I/O),
// so it can be unit-tested (scripts/test-brain-draft.ts). The route in
// app/api/brain/quotes/[id]/draft turns the result into an Estimate row.

export interface BrainLineItem {
  description: string;
  hours: number | null;
  amount: number;
}
export interface BrainMaterial {
  item: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
}
export interface BrainDraft {
  lowEstimate: number;
  expectedEstimate: number;
  highEstimate: number;
  complexity: number;
  scope: string;
  laborHours: number | null;
  lineItems: BrainLineItem[];
  materialList: BrainMaterial[];
  assumptions: string[];
  questions: string[];
  keyRisks: string[];
  confidence: number;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const strList = (v: unknown, max = 20): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max) : [];
const money = (n: number) => `$${n.toFixed(2)}`;

export function parseBrainDraft(input: any): { ok: true; draft: BrainDraft } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["body must be a JSON object"] };

  const low = num(input.low_estimate);
  const expected = num(input.expected_estimate);
  const high = num(input.high_estimate);
  if (low == null || low <= 0) errors.push("low_estimate must be a positive number");
  if (expected == null || expected <= 0) errors.push("expected_estimate must be a positive number");
  if (high == null || high <= 0) errors.push("high_estimate must be a positive number");
  if (low != null && expected != null && high != null && !(low <= expected && expected <= high)) {
    errors.push("estimates must satisfy low <= expected <= high");
  }

  let confidence = num(input.confidence);
  if (confidence == null) confidence = 0.6;
  if (confidence > 1 && confidence <= 100) confidence = confidence / 100; // tolerate 70 -> 0.70
  if (confidence < 0 || confidence > 1) errors.push("confidence must be between 0 and 1");

  const complexity = Math.min(10, Math.max(1, Math.round(num(input.complexity) ?? 5)));
  const laborHours = num(input.labor_hours);
  if (laborHours != null && laborHours < 0) errors.push("labor_hours cannot be negative");

  const lineItems: BrainLineItem[] = Array.isArray(input.line_items)
    ? input.line_items
        .map((l: any) => ({
          description: String(l?.description ?? "").trim(),
          hours: num(l?.hours),
          amount: num(l?.amount) ?? 0,
        }))
        .filter((l: BrainLineItem) => l.description.length > 0)
        .slice(0, 50)
    : [];

  const materialList: BrainMaterial[] = Array.isArray(input.material_list)
    ? input.material_list
        .map((m: any) => ({
          item: String(m?.item ?? "").trim(),
          quantity: num(m?.quantity) ?? 1,
          unit: String(m?.unit ?? "unit").trim() || "unit",
          estimatedPrice: num(m?.estimated_price) ?? 0,
        }))
        .filter((m: BrainMaterial) => m.item.length > 0)
        .slice(0, 100)
    : [];

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    draft: {
      lowEstimate: Math.round(low!),
      expectedEstimate: Math.round(expected!),
      highEstimate: Math.round(high!),
      complexity,
      scope: String(input.scope_summary ?? "").trim() || "Project analysis",
      laborHours,
      lineItems,
      materialList,
      assumptions: strList(input.assumptions),
      questions: strList(input.questions_for_customer),
      keyRisks: strList(input.key_risks),
      confidence: Math.round(confidence * 100) / 100,
    },
  };
}

// Markdown shown in the existing Estimate "breakdown" field. Carries the same
// sections as the API analyzer's breakdown plus Brain's extra review fields.
export function brainBreakdown(
  quote: { category: string; description: string },
  d: BrainDraft,
  photosViewed: number
): string {
  const lines = (xs: string[], empty: string) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : empty);
  const labor = d.lineItems.length
    ? d.lineItems
        .map((l) => `- ${l.description}${l.hours != null ? ` (${l.hours} h)` : ""}: ${money(l.amount)}`)
        .join("\n")
    : "Not itemized";
  const materials = d.materialList.length
    ? d.materialList
        .map((m) => `- ${m.item}: ${m.quantity} ${m.unit} @ ${money(m.estimatedPrice)} = ${money(m.quantity * m.estimatedPrice)}`)
        .join("\n")
    : "None estimated";
  return `**Draft — Brain** (review before sending)

**Project:** ${quote.category}
**Description:** ${quote.description}

**Scope:** ${d.scope}
**Complexity:** ${d.complexity}/10
**Labor hours:** ${d.laborHours ?? "—"}
**Confidence:** ${Math.round(d.confidence * 100)}%

**Estimates:**
- Low: $${d.lowEstimate}
- Expected: $${d.expectedEstimate}
- High: $${d.highEstimate}

**Labor / line items:**
${labor}

**Estimated Materials:**
${materials}

**Assumptions:**
${lines(d.assumptions, "None stated")}

**Questions for the customer:**
${lines(d.questions, "None")}

**Key Risks:**
${lines(d.keyRisks, "None identified")}

**Photos:** ${photosViewed > 0 ? `${photosViewed} photo(s) reviewed by Brain.` : "Draft based on description only."}`;
}
