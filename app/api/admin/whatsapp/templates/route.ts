import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listTemplates, waConfigured } from "@/lib/whatsapp/graph";

export const dynamic = "force-dynamic";

// GET — APPROVED message templates (for replying outside the 24h window).
export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!waConfigured()) return NextResponse.json({ templates: [] });
  try {
    const all = await listTemplates();
    return NextResponse.json({ templates: all.filter((t) => t.status === "APPROVED") });
  } catch (e) {
    return NextResponse.json({ templates: [], error: e instanceof Error ? e.message : String(e) });
  }
}
