// Unit tests for the Brain draft parser/formatter. Run: npx tsx scripts/test-brain-draft.ts
import assert from "assert";
import { parseBrainDraft, brainBreakdown } from "../lib/brain-draft";
import { buildEstimatorPrompt, brainDraftInstructions, HANDYMAN_PRICING, isWebDevCategory } from "../lib/estimator-prompt";

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log("  ok ", name); };

const good = {
  low_estimate: 590, expected_estimate: 826, high_estimate: 950, complexity: 4,
  scope_summary: "Replace 6 rotted deck boards", labor_hours: 5,
  line_items: [{ description: "Remove rotted boards", hours: 2, amount: 120 }, { description: "Install new boards", hours: 3, amount: 180 }],
  material_list: [{ item: "5/4x6x12 PT deck board", quantity: 6, unit: "board", estimated_price: 14.98 }],
  assumptions: ["Joists are sound"], questions_for_customer: ["Stain to match?"], key_risks: ["Hidden joist rot"], confidence: 0.7,
};

t("valid draft parses with all review fields", () => {
  const r = parseBrainDraft(good); assert.ok(r.ok);
  if (!r.ok) return;
  assert.strictEqual(r.draft.expectedEstimate, 826);
  assert.strictEqual(r.draft.laborHours, 5);
  assert.strictEqual(r.draft.lineItems.length, 2);
  assert.strictEqual(r.draft.materialList[0].estimatedPrice, 14.98);
  assert.deepStrictEqual(r.draft.questions, ["Stain to match?"]);
});
t("rejects missing / non-positive estimates", () => {
  const r = parseBrainDraft({ ...good, low_estimate: 0, expected_estimate: undefined });
  assert.ok(!r.ok); if (r.ok) return;
  assert.ok(r.errors.some((e) => e.includes("low_estimate")));
  assert.ok(r.errors.some((e) => e.includes("expected_estimate")));
});
t("rejects low > expected > high ordering errors", () => {
  const r = parseBrainDraft({ ...good, low_estimate: 1000 }); assert.ok(!r.ok);
});
t("confidence 70 is read as 0.70; 150 is rejected", () => {
  const a = parseBrainDraft({ ...good, confidence: 70 }); assert.ok(a.ok && a.draft.confidence === 0.7);
  assert.ok(!parseBrainDraft({ ...good, confidence: 150 }).ok);
});
t("money strings like \"$1,250\" parse", () => {
  const r = parseBrainDraft({ ...good, low_estimate: "$590", expected_estimate: "$826", high_estimate: "$1,250" });
  assert.ok(r.ok && r.draft.highEstimate === 1250);
});
t("non-object body is rejected", () => { assert.ok(!parseBrainDraft(null).ok); assert.ok(!parseBrainDraft("x").ok); });
t("breakdown is labeled Draft — Brain and carries questions + assumptions", () => {
  const r = parseBrainDraft(good); assert.ok(r.ok); if (!r.ok) return;
  const md = brainBreakdown({ category: "Deck repair", description: "boards" }, r.draft, 3);
  assert.ok(md.startsWith("**Draft — Brain**"));
  assert.ok(md.includes("Stain to match?") && md.includes("Joists are sound") && md.includes("3 photo(s) reviewed"));
});
t("handyman Brain instructions carry the README pricing formula", () => {
  const s = brainDraftInstructions({ category: "Deck repair" });
  assert.ok(s.includes(`$${HANDYMAN_PRICING.laborRatePerHour}/hour`) && s.includes("x 1.4") && s.includes("x 1.15") && s.includes("$35"));
});
t("web-dev category gets the studio pricing guide, not the handyman formula", () => {
  assert.ok(isWebDevCategory("Website & App Development"));
  const s = brainDraftInstructions({ category: "Website & App Development" });
  assert.ok(s.includes("$85/hour") && !s.includes("$60/hour"));
  assert.ok(buildEstimatorPrompt({ category: "Website & App Development", description: "x" }).includes("app development studio"));
});
console.log(`\n${passed} passed`);
