/**
 * Sunrise/sunset for a date + lat/lon using the standard NOAA/Wikipedia
 * sunrise equation (accurate to a couple of minutes — plenty for a jump-day
 * overview). Returns epoch-ms UTC instants; format them with the user's
 * timezone via Intl. Longitude is east-positive.
 */
export function sunTimes(
  dateKey: string,
  lat: number,
  lon: number
): { sunrise: number | null; sunset: number | null } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const rad = Math.PI / 180;

  // Days since the J2000 epoch (2000-01-01 12:00 UTC) for this date.
  const n =
    (Date.UTC(y, m - 1, d, 12) - Date.UTC(2000, 0, 1, 12)) / 86400000 + 0.0008;

  const Jstar = n - lon / 360; // mean solar noon
  const M = (357.5291 + 0.98560028 * Jstar) % 360; // solar mean anomaly
  const C =
    1.9148 * Math.sin(M * rad) +
    0.02 * Math.sin(2 * M * rad) +
    0.0003 * Math.sin(3 * M * rad); // equation of the center
  const L = (M + C + 180 + 102.9372) % 360; // ecliptic longitude
  const Jtransit =
    2451545.0 + Jstar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);

  const sinDec = Math.sin(L * rad) * Math.sin(23.4397 * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH =
    (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinDec) /
    (Math.cos(lat * rad) * cosDec);

  // Polar day/night: the sun never crosses the horizon.
  if (cosH < -1 || cosH > 1) return { sunrise: null, sunset: null };

  const H = Math.acos(cosH) / rad; // hour angle, degrees
  const jdToMs = (jd: number) => (jd - 2440587.5) * 86400000;
  return {
    sunrise: jdToMs(Jtransit - H / 360),
    sunset: jdToMs(Jtransit + H / 360),
  };
}
