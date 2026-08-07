import type { SkydiveHour } from "@/lib/skydive/nws";

/** The go/no-go thresholds — mirrors the fields on the SkydiveUser model. */
export interface SkydiveParams {
  maxWindMph: number;
  maxGustMph: number;
  maxPrecipPct: number;
  maxCloudPct: number;
  minCeilingFt: number;
  minTempF: number;
  maxTempF: number;
}

export interface HourVerdict extends SkydiveHour {
  safe: boolean;
  /** Human-readable reasons the hour fails, empty when safe. */
  reasons: string[];
  /** Local wall-clock hour (0-23) and date key for the user's timezone. */
  localHour: number;
  dateKey: string; // local "YYYY-MM-DD"
}

export type DayRating = "GOOD" | "LIMITED" | "NO_GO";

export interface DaySummary {
  dateKey: string;
  /** e.g. "Thursday, Aug 6" */
  label: string;
  rating: DayRating;
  safeHours: number;
  totalHours: number;
  /** Local hours (0-23) within the daylight window that pass all checks. */
  safeHourList: number[];
  /** The dominant blockers across unsafe daylight hours, worst-first. */
  topReasons: string[];
}

// Jumps happen in daylight; only these local hours count toward a day's rating.
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 19; // inclusive: 8am through 7pm local

const round = (v: number) => Math.round(v);

/** Check one forecast hour against the user's thresholds. */
export function evaluateHour(
  hour: SkydiveHour,
  params: SkydiveParams
): { safe: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (hour.thunder) reasons.push("Thunderstorms in the forecast");
  if (hour.windMph != null && hour.windMph > params.maxWindMph)
    reasons.push(`Wind ${round(hour.windMph)} mph (max ${params.maxWindMph})`);
  if (hour.gustMph != null && hour.gustMph > params.maxGustMph)
    reasons.push(`Gusts ${round(hour.gustMph)} mph (max ${params.maxGustMph})`);
  if (hour.precipPct != null && hour.precipPct > params.maxPrecipPct)
    reasons.push(
      `Precip chance ${round(hour.precipPct)}% (max ${params.maxPrecipPct}%)`
    );
  if (hour.cloudPct != null && hour.cloudPct > params.maxCloudPct)
    reasons.push(
      `Cloud cover ${round(hour.cloudPct)}% (max ${params.maxCloudPct}%)`
    );
  if (hour.ceilingFt != null && hour.ceilingFt < params.minCeilingFt)
    reasons.push(
      `Ceiling ${round(hour.ceilingFt).toLocaleString()} ft (min ${params.minCeilingFt.toLocaleString()} ft)`
    );
  if (hour.tempF != null && hour.tempF < params.minTempF)
    reasons.push(`Temp ${round(hour.tempF)}°F (min ${params.minTempF}°F)`);
  if (hour.tempF != null && hour.tempF > params.maxTempF)
    reasons.push(`Temp ${round(hour.tempF)}°F (max ${params.maxTempF}°F)`);

  return { safe: reasons.length === 0, reasons };
}

/** Get { dateKey, localHour, weekdayLabel } for an epoch ms in a timezone. */
function localParts(timeMs: number, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "long",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(timeMs))) parts[p.type] = p.value;
  const monthFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  });
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    localHour: Number(parts.hour) % 24,
    label: `${parts.weekday}, ${monthFmt.format(new Date(timeMs))}`,
  };
}

/** Evaluate every hour and attach local-time context. */
export function evaluateHours(
  hours: SkydiveHour[],
  params: SkydiveParams,
  timezone: string
): HourVerdict[] {
  return hours.map((h) => {
    const { safe, reasons } = evaluateHour(h, params);
    const { dateKey, localHour } = localParts(h.time, timezone);
    return { ...h, safe, reasons, localHour, dateKey };
  });
}

/**
 * Roll evaluated hours up into per-day summaries. Only daylight hours
 * (DAY_START_HOUR..DAY_END_HOUR local) count toward the rating:
 * GOOD = 4+ jumpable hours, LIMITED = 1-3, NO_GO = 0.
 */
export function summarizeDays(
  verdicts: HourVerdict[],
  timezone: string
): DaySummary[] {
  const byDay = new Map<string, HourVerdict[]>();
  for (const v of verdicts) {
    if (v.localHour < DAY_START_HOUR || v.localHour > DAY_END_HOUR) continue;
    const list = byDay.get(v.dateKey) || [];
    list.push(v);
    byDay.set(v.dateKey, list);
  }

  const days: DaySummary[] = [];
  for (const [dateKey, hours] of byDay) {
    const safe = hours.filter((h) => h.safe);
    const reasonCounts = new Map<string, number>();
    for (const h of hours) {
      for (const r of h.reasons) {
        // Collapse "Wind 17 mph (max 14)" style reasons to their factor so
        // the summary reads "Wind" once, not once per hour/value.
        const factor = r.split(/\s\d/)[0];
        reasonCounts.set(factor, (reasonCounts.get(factor) || 0) + 1);
      }
    }
    const topReasons = Array.from(reasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([factor]) => factor);

    days.push({
      dateKey,
      label: localParts(hours[0].time, timezone).label,
      rating: safe.length >= 4 ? "GOOD" : safe.length >= 1 ? "LIMITED" : "NO_GO",
      safeHours: safe.length,
      totalHours: hours.length,
      safeHourList: safe.map((h) => h.localHour),
      topReasons,
    });
  }
  return days.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** Format a local hour like 13 → "1pm" for compact email/UI copy. */
export function formatHour(h: number): string {
  const ampm = h >= 12 ? "pm" : "am";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${ampm}`;
}
