"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { skydivePath } from "../paths";
import {
  Params,
  Me,
  DaySummary,
  Forecast,
  RATING_UI,
  fmtHour,
  fmt,
} from "./types";
import SkydiverScene from "./SkydiverScene";

// Threshold inputs hold raw text while editing (so the field can be emptied
// mid-typing — coercing to Number onChange re-renders "" as 0, leaving a
// stuck leading zero on mobile). Values are parsed on save.
type DraftParams = Record<keyof Params, string>;

function toDraft(p: Params): DraftParams {
  return Object.fromEntries(
    Object.entries(p).map(([k, v]) => [k, String(v)])
  ) as DraftParams;
}

// --- Settings editor ---------------------------------------------------------

const THRESHOLD_FIELDS: Array<{ key: keyof Params; label: string; hint: string }> = [
  { key: "maxWindMph", label: "Max wind (mph)", hint: "sustained surface wind" },
  { key: "maxGustMph", label: "Max gusts (mph)", hint: "peak gusts" },
  { key: "maxPrecipPct", label: "Max precip chance (%)", hint: "chance of rain" },
  { key: "maxCloudPct", label: "Max cloud cover (%)", hint: "sky covered" },
  { key: "minCeilingFt", label: "Min ceiling (ft)", hint: "cloud base height" },
  { key: "minTempF", label: "Min temp (°F)", hint: "ground temperature" },
  { key: "maxTempF", label: "Max temp (°F)", hint: "ground temperature" },
];

export default function DashboardClient() {
  const search = useSearchParams();
  const u = search.get("u") || "";
  const t = search.get("t") || "";
  const auth = `u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`;

  const [me, setMe] = useState<Me | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const [draft, setDraft] = useState<DraftParams | null>(null);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [notifyHour, setNotifyHour] = useState(7);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadForecast = useCallback(async () => {
    const res = await fetch(`/api/skydive/forecast?${auth}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Couldn't load forecast");
    setForecast(data);
  }, [auth]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      await loadForecast();
    } catch (err: any) {
      setError(err?.message || "Couldn't refresh the forecast.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!u || !t) {
      setError("This page needs your personal link — check your welcome email.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const meRes = await fetch(`/api/skydive/me?${auth}`);
        const meData = await meRes.json();
        if (!meRes.ok) throw new Error(meData?.error || "Couldn't sign you in");
        setMe(meData);
        setDraft(toDraft(meData.params));
        setNotifyEnabled(meData.notifyEnabled);
        setNotifyHour(meData.notifyHour);
        await loadForecast();
      } catch (err: any) {
        setError(err?.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    })();
  }, [u, t, auth, loadForecast]);

  async function saveSettings() {
    if (!draft) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      // Parse the text fields; blank/invalid entries are simply not sent, so
      // the server keeps that threshold's previous value.
      const parsed: Partial<Params> = {};
      for (const { key } of THRESHOLD_FIELDS) {
        const raw = draft[key].trim();
        const n = Number(raw);
        if (raw !== "" && Number.isFinite(n)) parsed[key] = n;
      }
      const res = await fetch("/api/skydive/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ u, t, ...parsed, notifyEnabled, notifyHour }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Couldn't save settings");
      setSaved(true);
      // Keep the in-memory profile in sync so the charts use the new limits.
      setMe((m) => (m ? { ...m, params: { ...m.params, ...parsed } } : m));
      // Normalize the fields to what was actually saved ("010" -> "10").
      setDraft((d) =>
        d
          ? {
              ...d,
              ...(Object.fromEntries(
                Object.entries(parsed).map(([k, v]) => [k, String(v)])
              ) as Partial<DraftParams>),
            }
          : d
      );
      await loadForecast(); // re-score the forecast against the new limits
    } catch (err: any) {
      setError(err?.message || "Couldn't save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16 text-slate-400">
        Checking the skies for you…
      </main>
    );
  }

  if (error && !me) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold">Skydive Weather</h1>
        <p className="mt-4 rounded-lg border border-red-800 bg-red-950/50 p-4 text-red-300">
          {error}
        </p>
        <a href={skydivePath("/")} className="mt-6 inline-block text-sky-400 underline">
          ← Back to sign-up
        </a>
      </main>
    );
  }

  const today = forecast?.days[0];
  const todayUi = today ? RATING_UI[today.rating] : null;
  const daylight = (forecast?.hours || []).filter(
    (h) => h.localHour >= 8 && h.localHour <= 19
  );
  const dayKeys = (forecast?.days || []).slice(0, 3).map((d) => d.dateKey);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400">
            Skydive Weather
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            {forecast?.locationLabel || me?.locationLabel || "Your area"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {me?.name ? `${me.name} · ` : ""}
            {me?.email} · limits are yours alone
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={skydivePath(`/planes?${auth}`)}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-sky-500 hover:text-sky-300"
          >
            ✈ Plane Finder
          </a>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-sky-500 hover:text-sky-300 disabled:opacity-50"
            title="Re-check the latest NWS forecast"
          >
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
          {today && todayUi && (
            <div className={`rounded-xl px-6 py-4 text-center ${todayUi.cls}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                Today
              </p>
              <p className="text-xl font-black text-white">{todayUi.label}</p>
            </div>
          )}
          {today && forecast?.hours?.[0] && (
            <SkydiverScene
              windMph={forecast.hours[0].windMph}
              cloudPct={forecast.hours[0].cloudPct}
              precipPct={forecast.hours[0].precipPct}
              thunder={forecast.hours[0].thunder}
              rating={today.rating}
              label="Current conditions"
            />
          )}
        </div>
      </header>

      {error && (
        <p className="mt-4 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* 3-day outlook */}
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {(forecast?.days || []).slice(0, 3).map((day) => {
          const ui = RATING_UI[day.rating];
          return (
            <button
              key={day.dateKey}
              onClick={() =>
                router.push(
                  skydivePath(`/dashboard/day?d=${day.dateKey}&${auth}`)
                )
              }
              className={`rounded-xl border bg-slate-900/70 p-4 text-left transition hover:bg-slate-800/80 ${ui.ring}`}
            >
              <div
                className={`inline-block rounded-full px-3 py-1 text-xs font-bold text-white ${ui.cls}`}
              >
                {ui.label}
              </div>
              <p className="mt-2 font-semibold">{day.label}</p>
              <p className="mt-1 text-sm text-slate-400">
                {day.safeHours} of {day.totalHours} daylight hours in your limits
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {day.safeHours > 0
                  ? `Jumpable: ${day.safeHourList.map(fmtHour).join(", ")}`
                  : day.topReasons.length
                    ? `Blockers: ${day.topReasons.join(", ")}`
                    : "Outside forecast range"}
              </p>
              <p className="mt-2 text-xs text-sky-400">
                Graphs, stats &amp; details →
              </p>
            </button>
          );
        })}
        {forecast && forecast.days.length === 0 && (
          <p className="text-slate-400 sm:col-span-3">
            No forecast data available right now — try again shortly.
          </p>
        )}
      </section>

      {/* Hour-by-hour */}
      <section className="mt-10">
        <h2 className="text-lg font-bold">Hour by hour (daylight, 8am–7pm)</h2>
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
              {dayKeys.map((key) => {
                const day = forecast!.days.find((d) => d.dateKey === key)!;
                const rows = daylight.filter((h) => h.dateKey === key);
                return [
                  <tr key={`${key}-hdr`} className="bg-slate-900/80">
                    <td colSpan={8} className="px-3 py-2 font-semibold text-sky-300">
                      {day.label}
                    </td>
                  </tr>,
                  ...rows.map((h) => (
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
                          <span
                            className="font-semibold text-red-400"
                            title={h.reasons.join("; ")}
                          >
                            ✗ {h.reasons[0]?.split(" (")[0] || "No-go"}
                          </span>
                        )}
                      </td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Settings */}
      {draft && (
        <section className="mt-10 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-lg font-bold">Your safety limits</h2>
          <p className="mt-1 text-sm text-slate-400">
            The forecast above is scored against these. Thunderstorms are always
            a no-go regardless of settings.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {THRESHOLD_FIELDS.map(({ key, label, hint }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-300">
                  {label}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
                <p className="mt-1 text-xs text-slate-500">{hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-slate-800 pt-5">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={notifyEnabled}
                onChange={(e) => setNotifyEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              Email me a daily go / no-go outlook
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              around
              {/* Form controls don't inherit text color on Android — without an
                  explicit color the selected value renders black-on-dark. */}
              <select
                value={notifyHour}
                onChange={(e) => setNotifyHour(Number(e.target.value))}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 [color-scheme:dark]"
                disabled={!notifyEnabled}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {fmtHour(h)}
                  </option>
                ))}
              </select>
              local time
            </label>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="ml-auto rounded-lg bg-sky-600 px-6 py-2 font-bold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save & re-check"}
            </button>
          </div>
          {saved && (
            <p className="mt-3 text-sm text-emerald-400">
              Saved — forecast re-scored with your new limits.
            </p>
          )}
        </section>
      )}

      <footer className="mt-10 text-center text-xs text-slate-500">
        Forecast: National Weather Service · updated roughly hourly. Planning
        aid only — always confirm with your drop zone before jumping.
      </footer>
    </main>
  );
}
