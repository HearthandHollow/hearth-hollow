import { prisma } from "@/lib/prisma";

/**
 * Scheduling availability. A "date" is treated as a calendar day represented at
 * noon UTC, so it doesn't shift across day boundaries when displayed in US
 * timezones. Date keys are "YYYY-MM-DD".
 */

export const SLOTS = ["morning", "afternoon"] as const;
export type Slot = (typeof SLOTS)[number];

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse a "YYYY-MM-DD" key into a Date at noon UTC. Returns null if invalid. */
export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  return isNaN(d.getTime()) ? null : d;
}

export async function getAvailabilitySettings() {
  if (!prisma) throw new Error("Database not available");
  let settings = await prisma.availabilitySettings.findFirst();
  if (!settings) {
    settings = await prisma.availabilitySettings.create({ data: {} });
  }
  return settings;
}

function weekdayEnabled(settings: any, utcDay: number): boolean {
  // utcDay: 0 = Sunday ... 6 = Saturday
  return [
    settings.sunday,
    settings.monday,
    settings.tuesday,
    settings.wednesday,
    settings.thursday,
    settings.friday,
    settings.saturday,
  ][utcDay];
}

/** Bookable date keys within the window, excluding already-booked days. */
export async function getAvailableDates(): Promise<string[]> {
  if (!prisma) throw new Error("Database not available");
  const settings = await getAvailabilitySettings();
  const windowDays = (settings.bookingWindowWeeks || 8) * 7;

  const booked = await prisma.projectRequest.findMany({
    where: { scheduledDate: { not: null } },
    select: { scheduledDate: true },
  });
  const bookedSet = new Set(
    booked
      .map((b) => (b.scheduledDate ? dateKey(b.scheduledDate) : null))
      .filter((x): x is string => !!x)
  );

  const blockedSet = new Set(await getBlockedDateKeys());

  const dates: string[] = [];
  const today = new Date();
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12, 0, 0)
  );

  for (let i = 1; i <= windowDays; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    if (!weekdayEnabled(settings, d.getUTCDay())) continue;
    const key = dateKey(d);
    if (bookedSet.has(key)) continue;
    if (blockedSet.has(key)) continue;
    dates.push(key);
  }
  return dates;
}

/** Manually closed-off date keys ("YYYY-MM-DD"). */
export async function getBlockedDateKeys(): Promise<string[]> {
  if (!prisma) return [];
  const rows = await prisma.blockedDate.findMany({ select: { date: true } });
  return rows.map((r) => dateKey(r.date));
}

/** Booked date keys with the customer name, for admin display. */
export async function getBookedDates(): Promise<{ date: string; name: string }[]> {
  if (!prisma) return [];
  const rows = await prisma.projectRequest.findMany({
    where: { scheduledDate: { not: null } },
    select: { scheduledDate: true, customer: { select: { name: true } } },
  });
  return rows
    .filter((r) => r.scheduledDate)
    .map((r) => ({ date: dateKey(r.scheduledDate as Date), name: r.customer?.name || '' }));
}

/** Whether a specific date key is currently bookable (enabled weekday, in window, not taken). */
export async function isDateBookable(key: string): Promise<boolean> {
  const date = parseDateKey(key);
  if (!date) return false;
  const available = await getAvailableDates();
  return available.includes(key);
}
