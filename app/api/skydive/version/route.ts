import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Deployment marker: bump DEPLOY_STAMP in any PR when you want to confirm a
// specific merge has reached the live site (forge OTA auto-deploys main).
// Public and harmless — it exposes nothing but the stamp.
const DEPLOY_STAMP = "2026-08-31 plane-finder-direct-key";

export async function GET() {
  return NextResponse.json({ ok: true, stamp: DEPLOY_STAMP });
}
