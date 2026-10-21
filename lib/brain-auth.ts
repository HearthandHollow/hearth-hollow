import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

// Brain (Claude Code on Hunter's machine) authenticates to /api/brain/* with
// `Authorization: Bearer <BRAIN_API_TOKEN>`. Unset token = the whole Brain API is off.
// Brain only calls these when Hunter asks it to; nothing on the site calls Brain.
export function brainAuthError(req: NextRequest): NextResponse | null {
  const expected = (process.env.BRAIN_API_TOKEN || "").trim();
  if (expected.length < 32) {
    return NextResponse.json({ error: "Brain API not configured" }, { status: 503 });
  }
  const header = req.headers.get("authorization") || "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// Image types the estimator can look at (HEIC is converted to JPEG on upload).
export const BRAIN_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
