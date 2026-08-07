import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedSkydiveUser } from "@/lib/skydive/auth";
import { lookupPoint } from "@/lib/skydive/nws";

export const dynamic = "force-dynamic";

/** Clamp a numeric field into a sane range, or return undefined to skip it. */
function num(v: unknown, min: number, max: number): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const user = await getAuthedSkydiveUser(body.u, body.t);
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const data: Record<string, unknown> = {};

  // Thresholds
  const fields: Array<[string, number, number]> = [
    ["maxWindMph", 0, 60],
    ["maxGustMph", 0, 80],
    ["maxPrecipPct", 0, 100],
    ["maxCloudPct", 0, 100],
    ["minCeilingFt", 0, 20000],
    ["minTempF", -40, 120],
    ["maxTempF", -40, 130],
  ];
  for (const [field, min, max] of fields) {
    const v = num(body[field], min, max);
    if (v !== undefined) data[field] = v;
  }

  // Notification prefs
  if (typeof body.notifyEnabled === "boolean") data.notifyEnabled = body.notifyEnabled;
  const hour = num(body.notifyHour, 0, 23);
  if (hour !== undefined) data.notifyHour = Math.round(hour);

  // Optional location change: re-resolve the NWS grid for the new point.
  const lat = num(body.latitude, -90, 90);
  const lon = num(body.longitude, -180, 180);
  if (lat !== undefined && lon !== undefined) {
    try {
      const point = await lookupPoint(lat, lon);
      data.latitude = lat;
      data.longitude = lon;
      data.locationLabel = body.locationLabel
        ? String(body.locationLabel).slice(0, 120)
        : point.locationLabel;
      data.timezone = point.timezone;
      data.gridId = point.gridId;
      data.gridX = point.gridX;
      data.gridY = point.gridY;
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || "Couldn't find a forecast for that location." },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.skydiveUser.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json({ ok: true, locationLabel: updated.locationLabel });
}
