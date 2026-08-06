/**
 * National Weather Service (api.weather.gov) client for the Skydive Weather
 * site. This is the same NWS forecast that backs the forecast.weather.gov
 * "graphical" MapClick pages, but as structured JSON: a point lookup maps a
 * lat/lon onto a forecast-office grid cell, and the raw gridpoint endpoint
 * exposes hourly-resolution layers for everything skydivers care about —
 * temperature, sustained wind, gusts, sky cover, precip probability, cloud
 * ceiling, and thunder.
 *
 * NWS asks API consumers to identify themselves via User-Agent.
 */

const NWS_BASE = "https://api.weather.gov";
const USER_AGENT =
  "skydive-weather.thehearthhollow.com (support@thehearthhollow.com)";

export interface NwsPoint {
  gridId: string;
  gridX: number;
  gridY: number;
  timezone: string;
  locationLabel: string | null;
}

export interface SkydiveHour {
  /** Start of the hour, epoch ms (UTC). */
  time: number;
  tempF: number | null;
  windMph: number | null;
  gustMph: number | null;
  cloudPct: number | null;
  precipPct: number | null;
  /** Cloud-ceiling height in feet; null = unlimited / no ceiling reported. */
  ceilingFt: number | null;
  thunder: boolean;
}

async function nwsFetch(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
    // Forecasts update at most hourly; let Next cache briefly to be a good
    // API citizen and speed up repeat dashboard loads.
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    throw new Error(`NWS request failed (${res.status}) for ${url}`);
  }
  return res.json();
}

/** Resolve a lat/lon to its NWS forecast grid. Throws for non-US points. */
export async function lookupPoint(lat: number, lon: number): Promise<NwsPoint> {
  const data = await nwsFetch(
    `${NWS_BASE}/points/${lat.toFixed(4)},${lon.toFixed(4)}`
  );
  const p = data?.properties;
  if (!p?.gridId || p.gridX == null || p.gridY == null) {
    throw new Error(
      "That location isn't covered by the National Weather Service (US locations only)."
    );
  }
  const rel = p.relativeLocation?.properties;
  return {
    gridId: p.gridId,
    gridX: p.gridX,
    gridY: p.gridY,
    timezone: p.timeZone || "America/New_York",
    locationLabel: rel?.city && rel?.state ? `${rel.city}, ${rel.state}` : null,
  };
}

// --- Gridpoint layer parsing ------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;

/** Parse the hour count out of an ISO-8601 duration like "PT2H" or "P1DT4H". */
function durationHours(iso: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?)?/.exec(iso);
  if (!m) return 1;
  const days = m[1] ? parseInt(m[1], 10) : 0;
  const hours = m[2] ? parseInt(m[2], 10) : 0;
  return Math.max(1, days * 24 + hours);
}

/**
 * Expand an NWS layer ({ uom, values: [{ validTime: "<start>/<duration>",
 * value }] }) into a map of hour-start epoch ms → value, applying a unit
 * conversion. A value covers every hour of its duration.
 */
function expandLayer(
  layer: any,
  convert: (v: number, uom: string) => number
): Map<number, number | null> {
  const out = new Map<number, number | null>();
  const uom: string = layer?.uom || "";
  for (const entry of layer?.values || []) {
    const [start, duration] = String(entry.validTime || "").split("/");
    const startMs = Date.parse(start);
    if (!Number.isFinite(startMs)) continue;
    const hourStart = Math.floor(startMs / HOUR_MS) * HOUR_MS;
    const hours = durationHours(duration || "PT1H");
    const value =
      entry.value == null ? null : convert(Number(entry.value), uom);
    for (let i = 0; i < hours; i++) {
      out.set(hourStart + i * HOUR_MS, value);
    }
  }
  return out;
}

function toF(v: number, uom: string): number {
  return uom.includes("degF") ? v : (v * 9) / 5 + 32;
}

function toMph(v: number, uom: string): number {
  if (uom.includes("km_h")) return v * 0.621371;
  if (uom.includes("m_s")) return v * 2.23694;
  if (uom.includes("kn")) return v * 1.15078;
  return v; // assume already mph
}

function toFt(v: number, uom: string): number {
  if (uom.includes("wmoUnit:m") || uom === "m") return v * 3.28084;
  return v;
}

function identity(v: number): number {
  return v;
}

/** True when any weather phenomenon in the layer value mentions thunder. */
function expandThunder(layer: any): Map<number, boolean> {
  const out = new Map<number, boolean>();
  for (const entry of layer?.values || []) {
    const [start, duration] = String(entry.validTime || "").split("/");
    const startMs = Date.parse(start);
    if (!Number.isFinite(startMs)) continue;
    const hourStart = Math.floor(startMs / HOUR_MS) * HOUR_MS;
    const hours = durationHours(duration || "PT1H");
    const thunder = (entry.value || []).some((w: any) =>
      String(w?.weather || "").toLowerCase().includes("thunder")
    );
    for (let i = 0; i < hours; i++) {
      out.set(hourStart + i * HOUR_MS, thunder);
    }
  }
  return out;
}

/**
 * Fetch the raw gridpoint forecast and flatten it into an hourly series for
 * the next `hoursAhead` hours starting from the current hour.
 */
export async function fetchHourlyForecast(
  gridId: string,
  gridX: number,
  gridY: number,
  hoursAhead: number = 72
): Promise<SkydiveHour[]> {
  const data = await nwsFetch(
    `${NWS_BASE}/gridpoints/${gridId}/${gridX},${gridY}`
  );
  const p = data?.properties || {};

  const temp = expandLayer(p.temperature, toF);
  const wind = expandLayer(p.windSpeed, toMph);
  const gust = expandLayer(p.windGust, toMph);
  const sky = expandLayer(p.skyCover, identity);
  const pop = expandLayer(p.probabilityOfPrecipitation, identity);
  const ceiling = expandLayer(p.ceilingHeight, toFt);
  const thunder = expandThunder(p.weather);

  const firstHour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  const hours: SkydiveHour[] = [];
  for (let i = 0; i < hoursAhead; i++) {
    const t = firstHour + i * HOUR_MS;
    // Skip hours the forecast doesn't cover at all.
    if (!temp.has(t) && !wind.has(t) && !sky.has(t)) continue;
    hours.push({
      time: t,
      tempF: temp.get(t) ?? null,
      windMph: wind.get(t) ?? null,
      gustMph: gust.get(t) ?? null,
      cloudPct: sky.get(t) ?? null,
      precipPct: pop.get(t) ?? null,
      ceilingFt: ceiling.get(t) ?? null,
      thunder: thunder.get(t) ?? false,
    });
  }
  return hours;
}
