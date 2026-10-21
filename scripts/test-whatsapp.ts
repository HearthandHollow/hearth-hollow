// Unit tests for the WhatsApp Comms Hub core. Run: npx tsx scripts/test-whatsapp.ts
import assert from "assert";
import { createHmac } from "crypto";
import {
  verifySignature, maskNumber, projectFromText, projectFromMenuReply, optKeyword, windowOpen,
  parseWebhook, nextStatus, projectForToken, normalizeWaId, MENU_ROW_PREFIX,
} from "../lib/whatsapp/core";

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log("  ok ", name); };

const SECRET = "test-app-secret";
const sign = (body: string) => "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");

t("signature: valid HMAC passes", () => { const b = '{"a":1}'; assert.ok(verifySignature(b, sign(b), SECRET)); });
t("signature: tampered body, wrong secret, missing/garbled header fail", () => {
  const b = '{"a":1}';
  assert.ok(!verifySignature(b + " ", sign(b), SECRET));
  assert.ok(!verifySignature(b, sign(b), "other"));
  assert.ok(!verifySignature(b, null, SECRET));
  assert.ok(!verifySignature(b, "sha256=zz", SECRET));
  assert.ok(!verifySignature(b, sign(b), ""));
});
t("maskNumber shows only the last 4 digits", () => {
  assert.strictEqual(maskNumber("15551234567"), "…4567");
  assert.strictEqual(maskNumber("12"), "****");
});
t("project prefixes from deep links", () => {
  assert.strictEqual(projectFromText("RT: when is the next tournament?"), "RACKERTRACKER");
  assert.strictEqual(projectFromText("hh: deck repair"), "HANDYMAN");
  assert.strictEqual(projectFromText("FARM: a dozen eggs"), "HOMESTEAD");
  assert.strictEqual(projectFromText("FAB - gate hinge"), "FABRICATION");
  assert.strictEqual(projectFromText("Hello there"), null);
  assert.strictEqual(projectFromText("the RT: in the middle"), null);
});
t("menu replies map to projects; junk ids don't", () => {
  assert.strictEqual(projectFromMenuReply(MENU_ROW_PREFIX + "HOMESTEAD"), "HOMESTEAD");
  assert.strictEqual(projectFromMenuReply(MENU_ROW_PREFIX + "NOPE"), null);
  assert.strictEqual(projectFromMenuReply("HOMESTEAD"), null);
});
t("STOP / START keywords (case, punctuation)", () => {
  assert.strictEqual(optKeyword("stop"), "stop");
  assert.strictEqual(optKeyword(" Unsubscribe! "), "stop");
  assert.strictEqual(optKeyword("START"), "start");
  assert.strictEqual(optKeyword("please stop by tomorrow"), null);
});
t("24h window", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  assert.ok(windowOpen("2026-10-20T12:30:00Z", now));
  assert.ok(!windowOpen("2026-10-20T11:59:00Z", now));
  assert.ok(!windowOpen(null, now));
});

const inbound = {
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "15550000000", phone_number_id: "PNID" },
    contacts: [{ profile: { name: "Pat" }, wa_id: "15551234567" }],
    messages: [
      { from: "15551234567", id: "wamid.A", timestamp: "1792600000", type: "text", text: { body: "RT: hi" } },
      { from: "15551234567", id: "wamid.B", timestamp: "1792600001", type: "image", image: { id: "MEDIA1", mime_type: "image/jpeg", caption: "the deck" } },
      { from: "15551234567", id: "wamid.C", timestamp: "1792600002", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "proj:HANDYMAN", title: "Handyman quote" } } },
    ],
  } }] }],
};
t("parseWebhook: text, image (media id + caption), list reply", () => {
  const ev = parseWebhook(inbound);
  assert.strictEqual(ev.length, 3);
  const [a, b, c] = ev as any[];
  assert.strictEqual(a.kind, "message"); assert.strictEqual(a.text, "RT: hi"); assert.strictEqual(a.profileName, "Pat"); assert.strictEqual(a.phoneNumberId, "PNID");
  assert.strictEqual(b.mediaId, "MEDIA1"); assert.strictEqual(b.mediaMime, "image/jpeg"); assert.strictEqual(b.text, "the deck");
  assert.strictEqual(c.replyId, "proj:HANDYMAN"); assert.strictEqual(c.text, "Handyman quote");
  assert.strictEqual(a.timestamp.toISOString(), new Date(1792600000 * 1000).toISOString());
});
t("parseWebhook: statuses incl. failure error; ignores other objects/fields", () => {
  const ev = parseWebhook({ object: "whatsapp_business_account", entry: [{ changes: [
    { field: "messages", value: { metadata: { phone_number_id: "PNID" }, statuses: [
      { id: "wamid.X", status: "failed", timestamp: "1792600010", recipient_id: "1555", errors: [{ code: 131047, title: "Re-engagement message" }] }] } },
    { field: "account_update", value: {} },
  ] }] }) as any[];
  assert.strictEqual(ev.length, 1); assert.strictEqual(ev[0].status, "failed"); assert.strictEqual(ev[0].errorCode, 131047);
  assert.strictEqual(parseWebhook({ object: "page" }).length, 0);
});
t("status never moves backwards; failed always wins", () => {
  assert.strictEqual(nextStatus("read", "delivered"), "read");
  assert.strictEqual(nextStatus("sent", "delivered"), "delivered");
  assert.strictEqual(nextStatus("delivered", "failed"), "failed");
  assert.strictEqual(nextStatus(null, "sent"), "sent");
});
t("send-API tokens are per project and timing-safe", () => {
  const env = "RACKERTRACKER:rt_aaaaaaaaaaaaaaaaaaaaaaaaaaaa,HANDYMAN:hh_bbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  assert.strictEqual(projectForToken("Bearer rt_aaaaaaaaaaaaaaaaaaaaaaaaaaaa", env), "RACKERTRACKER");
  assert.strictEqual(projectForToken("Bearer hh_bbbbbbbbbbbbbbbbbbbbbbbbbbbb", env), "HANDYMAN");
  assert.strictEqual(projectForToken("Bearer rt_aaaaaaaaaaaaaaaaaaaaaaaaaaaX", env), null);
  assert.strictEqual(projectForToken("Bearer short", env), null);
  assert.strictEqual(projectForToken(null, env), null);
  assert.strictEqual(projectForToken("Bearer rt_aaaaaaaaaaaaaaaaaaaaaaaaaaaa", "BOGUS:rt_aaaaaaaaaaaaaaaaaaaaaaaaaaaa"), null);
});
t("normalizeWaId", () => {
  assert.strictEqual(normalizeWaId("+1 (555) 010-1234"), "15550101234");
  assert.strictEqual(normalizeWaId("123"), null);
});
console.log(`\n${passed} passed`);
