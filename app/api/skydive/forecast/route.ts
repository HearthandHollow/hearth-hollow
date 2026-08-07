import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedSkydiveUser } from "@/lib/skydive/auth";
import { fetchHourlyForecast, lookupPoint } from "@/lib/skydive/nws";
import { evaluateHours, summarizeDays } from "@/lib/skydive/evaluate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthedSkydiveUser(
    req.nextUrl.searchParams.get("u"),
    req.nextUrl.searchParams.get("t")
  );
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  try {
    // Self-heal users saved before the grid lookup existed (or after an NWS
    // grid change): resolve and cache the grid on the fly.
    let { gridId, gridX, gridY } = user;
    if (!gridId || gridX == null || gridY == null) {
      const point = await lookupPoint(user.latitude, user.longitude);
      gridId = point.gridId;
      gridX = point.gridX;
      gridY = point.gridY;
      await prisma.skydiveUser.update({
        where: { id: user.id },
        data: {
          gridId,
          gridX,
          gridY,
          timezone: point.timezone,
          locationLabel: user.locationLabel || point.locationLabel,
        },
      });
    }

    const hours = await fetchHourlyForecast(gridId, gridX, gridY, 72);
    const verdicts = evaluateHours(hours, user, user.timezone);
    const days = summarizeDays(verdicts, user.timezone);

    return NextResponse.json({
      locationLabel: user.locationLabel,
      timezone: user.timezone,
      hours: verdicts,
      days,
      generatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Skydive forecast failed:", error);
    return NextResponse.json(
      { error: "Couldn't load the forecast right now. Please try again shortly." },
      { status: 502 }
    );
  }
}
