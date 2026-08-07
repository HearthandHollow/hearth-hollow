import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedSkydiveUser } from "@/lib/skydive/auth";
import { getSkydiveBaseUrl } from "@/lib/skydive/site";

export const dynamic = "force-dynamic";

// One-click unsubscribe from the daily email (linked from every email footer).
// The account and dashboard keep working; only notifications stop.
export async function GET(req: NextRequest) {
  const user = await getAuthedSkydiveUser(
    req.nextUrl.searchParams.get("u"),
    req.nextUrl.searchParams.get("t")
  );
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  await prisma.skydiveUser.update({
    where: { id: user.id },
    data: { notifyEnabled: false },
  });

  return NextResponse.redirect(`${getSkydiveBaseUrl()}/unsubscribed`);
}
