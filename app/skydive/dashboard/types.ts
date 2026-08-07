/**
 * Shared client-side types + tiny formatters for the skydive dashboard pages.
 * The shapes mirror the /api/skydive/me and /api/skydive/forecast responses.
 */

export interface Params {
  maxWindMph: number;
  maxGustMph: number;
  maxPrecipPct: number;
  maxCloudPct: number;
  minCeilingFt: number;
  minTempF: number;
  maxTempF: number;
}

export interface Me {
  id: string;
  email: string;
  name: string | null;
  latitude: number;
  longitude: number;
  locationLabel: string | null;
  timezone: string;
  params: Params;
  notifyEnabled: boolean;
  notifyHour: number;
}

export interface HourVerdict {
  time: number;
  tempF: number | null;
  windMph: number | null;
  gustMph: number | null;
  cloudPct: number | null;
  precipPct: number | null;
  ceilingFt: number | null;
  thunder: boolean;
  safe: boolean;
  reasons: string[];
  localHour: number;
  dateKey: string;
}

export interface DaySummary {
  dateKey: string;
  label: string;
  rating: "GOOD" | "LIMITED" | "NO_GO";
  safeHours: number;
  totalHours: number;
  safeHourList: number[];
  topReasons: string[];
}

export interface Forecast {
  locationLabel: string | null;
  timezone: string;
  hours: HourVerdict[];
  days: DaySummary[];
}

export const RATING_UI = {
  GOOD: { label: "GOOD TO JUMP", cls: "bg-emerald-600", ring: "border-emerald-500" },
  LIMITED: { label: "LIMITED WINDOWS", cls: "bg-amber-600", ring: "border-amber-500" },
  NO_GO: { label: "NO-GO", cls: "bg-red-600", ring: "border-red-500" },
} as const;

export function fmtHour(h: number): string {
  const ampm = h >= 12 ? "pm" : "am";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${ampm}`;
}

export const fmt = (v: number | null, suffix = "") =>
  v == null ? "—" : `${Math.round(v)}${suffix}`;
