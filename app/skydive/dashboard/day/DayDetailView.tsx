"use client";

import { useState } from "react";
import DayCharts from "../DayCharts";
import SkydiverScene from "../SkydiverScene";
import { DaySummary, HourVerdict, Params, RATING_UI, fmt, fmtHour } from "../types";
import { factFor } from "./facts";
import { sunTimes } from "./suntimes";

/** Longest consecutive run of jumpable hours, e.g. "11am–3pm (4 hrs)". */
function bestWindow(hours: HourVerdict[]): string | null {
  let best: { start: number; len: number } | null = null;
  let run: { start: number; len: number } | null = null;
  for (const h of hours) {
    if (h.safe) {
      run = run
        ? { start: run.start, len: run.len + 1 }
        : { start: h.localHour, len: 1 };
      if (!best || run.len > best.len) best = run;
    } else {
      run = null;
    }
  }
  if (!best) return null;
  return `${fmtHour(best.start)}–${fmtHour(best.start + best.len)} (${best.len} hr${
    best.len > 1 ? "s" : ""
  })`;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function DayDetailView({
  day,
  hours,
  limits,
  locationLabel,
  timezone,
  latitude,
  longitude,
  backHref,
}: {
  day: DaySummary;
  hours: HourVerdict[]; // daylight hours of this day, in order
  limits: Params;
  locationLabel: string | null;
  timezone: string;
  latitude: number;
  longitude: number;
  backHref: string;
}) {
  const [showHours, setShowHours] = useState(false);
  const ui = RATING_UI[day.rating];
  const fact = factFor(day.dateKey);

  const nums = (pick: (h: HourVerdict) => number | null) =>
    hours.map(pick).filter((v): v is number => v != null);
  const maxN = (vals: number[]) => (vals.length ? Math.max(...vals) : null);
  const minN = (vals: number[]) => (vals.length ? Math.min(...vals) : null);

  const temps = nums((h) => h.tempF);
  const peakWind = maxN(nums((h) => h.windMph));
  const peakGust = maxN(nums((h) => h.gustMph));
  const maxCloud = maxN(nums((h) => h.cloudPct));
  const maxPrecip = maxN(nums((h) => h.precipPct));
  const minCeiling = minN(nums((h) => h.ceilingFt));
  const anyThunder = hours.some((h) => h.thunder);
  const window_ = bestWindow(hours);

  const sun = sunTimes(day.dateKey, latitude, longitude);
  const sunFmt = (ms: number | null) =>
    ms == null
      ? "—"
      : new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: timezone,
        }).format(new Date(ms));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <a href={backHref} className="text-sm text-sky-400 hover:text-sky-300">
        ← Back to dashboard
      </a>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{day.label}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {locationLabel || "Your area"} · daylight window 8am–7pm
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`rounded-xl px-6 py-4 text-center ${ui.cls}`}>
            <p className="text-xl font-black text-white">{ui.label}</p>
            <p className="text-xs font-semibold text-white/80">
              {day.safeHours} of {day.totalHours} hours in your limits
            </p>
          </div>
          <SkydiverScene
            windMph={peakWind}
            cloudPct={maxCloud}
            precipPct={maxPrecip}
            thunder={anyThunder}
            rating={day.rating}
            label="This day's conditions"
          />
        </div>
      </header>

      {/* Day stats */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile
          label="Best jump window"
          value={window_ || "None"}
          sub={window_ ? "longest all-clear stretch" : day.topReasons.slice(0, 2).join(", ") || undefined}
        />
        <StatTile
          label="Temperature"
          value={temps.length ? `${Math.round(minN(temps)!)}–${Math.round(maxN(temps)!)}°F` : "—"}
          sub={`your range ${limits.minTempF}–${limits.maxTempF}°F`}
        />
        <StatTile
          label="Peak wind"
          value={fmt(peakWind, " mph")}
          sub={`limit ${limits.maxWindMph} mph`}
        />
        <StatTile
          label="Peak gusts"
          value={fmt(peakGust, " mph")}
          sub={`limit ${limits.maxGustMph} mph`}
        />
        <StatTile
          label="Max cloud cover"
          value={fmt(maxCloud, "%")}
          sub={`limit ${limits.maxCloudPct}%`}
        />
        <StatTile
          label="Max rain chance"
          value={fmt(maxPrecip, "%")}
          sub={`limit ${limits.maxPrecipPct}%`}
        />
        <StatTile
          label="Lowest ceiling"
          value={
            minCeiling == null ? "Clear" : `${Math.round(minCeiling).toLocaleString()} ft`
          }
          sub={anyThunder ? "⛈ thunder in forecast" : `min ${limits.minCeilingFt.toLocaleString()} ft`}
        />
        <StatTile label="Sunrise / sunset" value={`${sunFmt(sun.sunrise)}`} sub={`sets ${sunFmt(sun.sunset)}`} />
      </section>

      {/* Graphs */}
      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-bold">Hourly graphs</h2>
        <div className="mt-5">
          <DayCharts hours={hours} limits={limits} />
        </div>
      </section>

      {/* Hour-by-hour toggle */}
      <section className="mt-8">
        <button
          onClick={() => setShowHours((s) => !s)}
          aria-expanded={showHours}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-left font-semibold text-slate-200 hover:border-sky-500"
        >
          {showHours ? "▾ Hide" : "▸ Show"} each hour
        </button>
        {showHours && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Temp</th>
                  <th className="px-3 py-2">Wind</th>
                  <th className="px-3 py-2">Gusts</th>
                  <th className="px-3 py-2">Clouds</th>
                  <th className="px-3 py-2">Precip</th>
                  <th className="px-3 py-2">Ceiling</th>
                  <th className="px-3 py-2">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {hours.map((h) => (
                  <tr
                    key={h.time}
                    className={`border-t border-slate-800/60 ${
                      h.safe ? "bg-emerald-950/30" : "bg-red-950/20"
                    }`}
                  >
                    <td className="px-3 py-2 font-medium">{fmtHour(h.localHour)}</td>
                    <td className="px-3 py-2">{fmt(h.tempF, "°F")}</td>
                    <td className="px-3 py-2">{fmt(h.windMph, " mph")}</td>
                    <td className="px-3 py-2">{fmt(h.gustMph, " mph")}</td>
                    <td className="px-3 py-2">{fmt(h.cloudPct, "%")}</td>
                    <td className="px-3 py-2">{fmt(h.precipPct, "%")}</td>
                    <td className="px-3 py-2">
                      {h.ceilingFt == null
                        ? "clear"
                        : `${Math.round(h.ceilingFt).toLocaleString()} ft`}
                      {h.thunder && " ⛈"}
                    </td>
                    <td className="px-3 py-2">
                      {h.safe ? (
                        <span className="font-semibold text-emerald-400">✓ Go</span>
                      ) : (
                        <span className="font-semibold text-red-400">
                          ✗ {h.reasons[0]?.split(" (")[0] || "No-go"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Fun fact */}
      <section className="mt-8 rounded-2xl border border-sky-900 bg-sky-950/40 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          🪂 {fact.title}
        </p>
        <p className="mt-2 text-slate-200">{fact.text}</p>
      </section>
    </main>
  );
}
