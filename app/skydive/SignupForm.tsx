"use client";

import { useState } from "react";

interface ResolvedLocation {
  latitude: number;
  longitude: number;
  label: string | null;
}

export default function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { existing: boolean }>(null);

  async function lookupZip(value: string) {
    setError(null);
    setLocation(null);
    if (!/^\d{5}$/.test(value)) return;
    setLocating(true);
    try {
      // Free, keyless US ZIP → lat/lon lookup, done in the browser.
      const res = await fetch(`https://api.zippopotam.us/us/${value}`);
      if (!res.ok) throw new Error("ZIP code not found");
      const data = await res.json();
      const place = data?.places?.[0];
      if (!place) throw new Error("ZIP code not found");
      setLocation({
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),
        label: `${place["place name"]}, ${place["state abbreviation"]}`,
      });
    } catch {
      setError("Couldn't find that ZIP code — double-check it, or use your device location.");
    } finally {
      setLocating(false);
    }
  }

  function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location — enter a ZIP code instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setZip("");
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          label: null, // server fills in the nearest city from the NWS lookup
        });
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location — enter a ZIP code instead.");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!location) {
      setError("Set your area first — enter a ZIP code or use your device location.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/skydive/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          latitude: location.latitude,
          longitude: location.longitude,
          locationLabel: location.label,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");
      setDone({ existing: !!data.existing });
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-700 bg-emerald-950/50 p-5">
        <p className="font-semibold text-emerald-300">
          {done.existing ? "Welcome back!" : "Check your inbox 🎉"}
        </p>
        <p className="mt-2 text-sm text-slate-300">
          We{done.existing ? " re-sent" : " sent"} your personal dashboard link
          to <span className="font-medium">{email}</span>. Open it to see your
          go / no-go forecast and set your limits.
        </p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none";

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-300">Name</label>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Optional"
          maxLength={100}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-300">Email *</label>
        <input
          className={inputCls}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-300">
          Your area (US) *
        </label>
        <div className="flex gap-2">
          <input
            className={inputCls}
            inputMode="numeric"
            value={zip}
            onChange={(e) => {
              setZip(e.target.value);
              lookupZip(e.target.value);
            }}
            placeholder="ZIP code"
            maxLength={5}
          />
          <button
            type="button"
            onClick={useMyLocation}
            className="whitespace-nowrap rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-sky-500 hover:text-sky-300"
          >
            📍 Use my location
          </button>
        </div>
        {locating && <p className="mt-2 text-sm text-slate-400">Locating…</p>}
        {location && (
          <p className="mt-2 text-sm text-emerald-400">
            ✓ {location.label ||
              `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-sky-600 py-3 font-bold text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {submitting ? "Signing you up…" : "Get my go / no-go forecasts"}
      </button>
    </form>
  );
}
