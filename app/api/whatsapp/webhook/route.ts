import { NextRequest, NextResponse } from "next/server";
import { verifySignature, parseWebhook } from "@/lib/whatsapp/core";
import { processEvents } from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

// GET — Meta's subscription handshake: echo hub.challenge when hub.verify_token matches.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN || "";
  if (p.get("hub.mode") === "subscribe" && expected && p.get("hub.verify_token") === expected) {
    return new NextResponse(p.get("hub.challenge") || "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// POST — messages + delivery statuses. Signature is checked on the RAW body.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.WHATSAPP_APP_SECRET || "";
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const events = parseWebhook(payload);
  // Store before acknowledging (DB writes are fast; media download and alerts don't block
  // on Meta). Errors are logged per event and still return 200 so Meta doesn't hammer retries
  // for a single bad event.
  const result = await processEvents(events);
  return NextResponse.json({ received: true, ...result });
}
