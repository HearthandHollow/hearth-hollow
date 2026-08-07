"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { skydivePath } from "../../paths";
import { Forecast, Me } from "../types";
import DayDetailView from "./DayDetailView";

export default function DayDetailClient() {
  const search = useSearchParams();
  const u = search.get("u") || "";
  const t = search.get("t") || "";
  const d = search.get("d") || "";
  const auth = `u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`;
  const backHref = skydivePath(`/dashboard?${auth}`);

  const [me, setMe] = useState<Me | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!u || !t || !d) {
      setError("This page needs your personal link — open it from your dashboard.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [meRes, fcRes] = await Promise.all([
          fetch(`/api/skydive/me?${auth}`),
          fetch(`/api/skydive/forecast?${auth}`),
        ]);
        const meData = await meRes.json();
        if (!meRes.ok) throw new Error(meData?.error || "Couldn't sign you in");
        const fcData = await fcRes.json();
        if (!fcRes.ok) throw new Error(fcData?.error || "Couldn't load forecast");
        setMe(meData);
        setForecast(fcData);
      } catch (err: any) {
        setError(err?.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    })();
  }, [u, t, d, auth]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16 text-slate-400">
        Loading the day&apos;s details…
      </main>
    );
  }

  const day = forecast?.days.find((x) => x.dateKey === d);

  if (error || !me || !forecast || !day) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold">Skydive Weather</h1>
        <p className="mt-4 rounded-lg border border-red-800 bg-red-950/50 p-4 text-red-300">
          {error || "That day isn't in the current forecast window anymore."}
        </p>
        <a href={backHref} className="mt-6 inline-block text-sky-400 underline">
          ← Back to dashboard
        </a>
      </main>
    );
  }

  const hours = forecast.hours.filter(
    (h) => h.dateKey === d && h.localHour >= 8 && h.localHour <= 19
  );

  return (
    <DayDetailView
      day={day}
      hours={hours}
      limits={me.params}
      locationLabel={forecast.locationLabel || me.locationLabel}
      timezone={me.timezone}
      latitude={me.latitude}
      longitude={me.longitude}
      backHref={backHref}
    />
  );
}
