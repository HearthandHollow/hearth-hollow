import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { quoteApiEnabled, quoteApiDailyCap } from "@/lib/ai-flags";

export const dynamic = "force-dynamic";

// GET /api/admin/ai-status — lets the quote page hide the API "Analyze" controls
// when QUOTE_ANALYSIS_API_ENABLED is off (the default; Brain drafts instead).
export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ apiEnabled: quoteApiEnabled(), dailyCap: quoteApiDailyCap() });
}
