import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchHourlyForecast } from "@/lib/skydive/nws";
import { evaluateHours, summarizeDays } from "@/lib/skydive/evaluate";
import { sendSkydiveDailyEmail } from "@/lib/skydive/email";

export const dynamic = "force-dynamic";

// Daily skydive go/no-go emails. Hit HOURLY by the external scheduler
// (cron-job.org — same setup as /api/cron/check-email-replies): each run sends
// to users whose local clock has reached their chosen notifyHour and who
// haven't been emailed yet today (their local date), so one hourly cron
// serves every timezone.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.nextUrl.searchParams.get("secret") === secret;
}

/** Local "YYYY-MM-DD" and hour-of-day for a timezone, right now. */
function localNow(timezone: string): { dateKey: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date())) parts[p.type] = p.value;
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const users = await prisma.skydiveUser.findMany({
    where: { notifyEnabled: true },
    take: 500,
  });

  // Users in the same NWS grid cell share one forecast fetch per run.
  const forecastCache = new Map<string, ReturnType<typeof fetchHourlyForecast>>();

  let due = 0;
  let sent = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      if (!user.gridId || user.gridX == null || user.gridY == null) continue;

      const { dateKey, hour } = localNow(user.timezone);
      if (hour < user.notifyHour) continue; // not their send time yet
      if (user.lastNotifiedDate === dateKey) continue; // already sent today
      due++;

      const gridKey = `${user.gridId}/${user.gridX},${user.gridY}`;
      if (!forecastCache.has(gridKey)) {
        forecastCache.set(
          gridKey,
          fetchHourlyForecast(user.gridId, user.gridX, user.gridY, 72)
        );
      }
      const hours = await forecastCache.get(gridKey)!;

      const verdicts = evaluateHours(hours, user, user.timezone);
      const days = summarizeDays(verdicts, user.timezone).filter(
        (d) => d.dateKey >= dateKey
      );

      await sendSkydiveDailyEmail(
        user.id,
        user.email,
        user.name,
        user.locationLabel,
        days
      );
      await prisma.skydiveUser.update({
        where: { id: user.id },
        data: { lastNotifiedDate: dateKey },
      });
      sent++;
    } catch (err: any) {
      errors.push(`${user.email}: ${err?.message || err}`);
    }
  }

  return NextResponse.json({ users: users.length, due, sent, errors });
}
