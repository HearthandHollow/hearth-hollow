import { NextRequest, NextResponse } from "next/server";
import { getAuthedSkydiveUser } from "@/lib/skydive/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthedSkydiveUser(
    req.nextUrl.searchParams.get("u"),
    req.nextUrl.searchParams.get("t")
  );
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    latitude: user.latitude,
    longitude: user.longitude,
    locationLabel: user.locationLabel,
    timezone: user.timezone,
    params: {
      maxWindMph: user.maxWindMph,
      maxGustMph: user.maxGustMph,
      maxPrecipPct: user.maxPrecipPct,
      maxCloudPct: user.maxCloudPct,
      minCeilingFt: user.minCeilingFt,
      minTempF: user.minTempF,
      maxTempF: user.maxTempF,
    },
    notifyEnabled: user.notifyEnabled,
    notifyHour: user.notifyHour,
  });
}
