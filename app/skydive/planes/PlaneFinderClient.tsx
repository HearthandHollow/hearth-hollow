"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { skydivePath } from "../paths";

interface PlaneOption {
  name: string;
  price: string;
  year: string;
  location: string;
  url: string;
  source: string;
  details: string;
  history: string;
  importCost: { applicable: boolean; breakdown: string; estimatedTotal: string } | null;
}

interface SearchResult {
  summary: string;
  options: PlaneOption[];
  sites: { name: string; url: string; bestFor: string }[];
  cautions: string;
  raw?: string;
}

const PROGRESS_LINES = [
  "Sweeping Controller, Trade-A-Plane, and ASO…",
  "Checking Barnstormers and GlobalAir…",
  "Looking at overseas listings on Planecheck and AvBuyer…",
  "Digging into aircraft history and engine times…",
  "Estimating import costs for overseas candidates…",
  "Writing up your options…",
];

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none";
const labelCls = "mb-1 block text-sm font-medium text-slate-300";

export default function PlaneFinderClient() {
  const search = useSearchParams();
  const u = search.get("u") || "";
  const t = search.get("t") || "";
  const backHref = skydivePath(`/dashboard?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`);

  const [intent, setIntent] = useState<"buy" | "lease">("buy");
  const [budget, setBudget] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [aircraftClass, setAircraftClass] = useState("any");
  const [region, setRegion] = useState("US only");
  const [notes, setNotes] = useState("");

  const [searching, setSearching] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Rotate the progress line while the deep dive runs (it takes a minute or two).
  useEffect(() => {
    if (!searching) return;
    const id = setInterval(
      () => setProgressIdx((i) => (i + 1) % PROGRESS_LINES.length),
      9000
    );
    return () => clearInterval(id);
  }, [searching]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSearching(true);
    setProgressIdx(0);
    try {
      const res = await fetch("/api/skydive/planes/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ u, t, intent, budget, capacity, aircraftClass, region, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Search failed");
      setResult(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err: any) {
      setError(err?.message || "Search failed — please try again.");
    } finally {
      setSearching(false);
    }
  }

  if (!u || !t) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold">Plane Finder</h1>
        <p className="mt-4 rounded-lg border border-red-800 bg-red-950/50 p-4 text-red-300">
          This page needs your personal link — open it from your dashboard.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <a href={backHref} className="text-sm text-sky-400 hover:text-sky-300">
        ← Back to dashboard
      </a>
      <h1 className="mt-4 text-3xl font-bold">✈ Plane Finder</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Set your guidelines and we&apos;ll do a live deep dive across the major
        aircraft marketplaces — for sale and for lease, US and overseas — pull
        what history we can find on each candidate, and estimate import costs
        for anything located abroad.
      </p>

      {/* Guidelines form */}
      <form
        onSubmit={runSearch}
        className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelCls}>I want to</label>
            <div className="flex gap-2">
              {(["buy", "lease"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setIntent(v)}
                  className={`flex-1 rounded-lg border px-3 py-2 font-semibold capitalize ${
                    intent === v
                      ? "border-sky-500 bg-sky-600/20 text-sky-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {v === "lease" ? "Rent / Lease" : "Buy"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>
              Budget {intent === "lease" ? "(per month/hour)" : "(max)"}
            </label>
            <input
              className={inputCls}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder={intent === "lease" ? "e.g. $10k/month" : "e.g. $400,000"}
              maxLength={100}
            />
          </div>
          <div>
            <label className={labelCls}>Jumpers per load</label>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            >
              <option value="4">~4 (small piston)</option>
              <option value="8-10">8–10</option>
              <option value="14-17">14–17 (turbine single)</option>
              <option value="20+">20+ (twin turbine)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Aircraft class</label>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={aircraftClass}
              onChange={(e) => setAircraftClass(e.target.value)}
            >
              <option value="any">Any — surprise me</option>
              <option value="piston single">Piston single (C182/206)</option>
              <option value="turbine single">Turbine single (Caravan, PAC 750, Kodiak)</option>
              <option value="twin turbine">Twin turbine (Twin Otter, Skyvan)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option>US only</option>
              <option>North America</option>
              <option>Worldwide</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelCls}>Anything else? (optional)</label>
            <textarea
              className={inputCls}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. must have jump door already installed, prefer low engine time, garmin panel…"
              maxLength={500}
            />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={searching}
            className="rounded-lg bg-sky-600 px-8 py-3 font-bold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {searching ? "Searching…" : "🔎 Find my plane"}
          </button>
          <p className="text-xs text-slate-500">
            Live research — takes a minute or two. Limited to 5 searches/hour.
          </p>
        </div>
        {searching && (
          <div className="mt-5 flex items-center gap-3 rounded-lg border border-sky-900 bg-sky-950/40 p-4">
            <span className="h-3 w-3 animate-ping rounded-full bg-sky-400" />
            <p className="text-sm text-sky-200">{PROGRESS_LINES[progressIdx]}</p>
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </form>

      {/* Results */}
      {result && (
        <div ref={resultsRef} className="mt-10 space-y-8">
          {result.summary && (
            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-lg font-bold">Market overview</h2>
              <p className="mt-2 text-slate-300">{result.summary}</p>
            </section>
          )}

          {result.options.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">Your options</h2>
              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                {result.options.map((o, i) => (
                  <div key={i} className="flex flex-col rounded-2xl border border-slate-700 bg-slate-900 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-bold text-sky-300">{o.name}</h3>
                      <span className="whitespace-nowrap rounded-full bg-emerald-900/60 px-3 py-1 text-sm font-bold text-emerald-300">
                        {o.price}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      {[o.location, o.source && `via ${o.source}`].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-3 text-sm text-slate-300">{o.details}</p>
                    {o.history && (
                      <p className="mt-3 text-sm text-slate-400">
                        <span className="font-semibold text-slate-300">History: </span>
                        {o.history}
                      </p>
                    )}
                    {o.importCost?.applicable && (
                      <div className="mt-3 rounded-lg border border-amber-900 bg-amber-950/40 p-3">
                        <p className="text-sm font-semibold text-amber-300">
                          🌍 Import estimate: {o.importCost.estimatedTotal}
                        </p>
                        <p className="mt-1 text-xs text-amber-200/80">{o.importCost.breakdown}</p>
                      </div>
                    )}
                    {o.url && (
                      <a
                        href={o.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block rounded-lg border border-sky-700 px-4 py-2 text-center text-sm font-semibold text-sky-300 hover:border-sky-500"
                      >
                        View listing ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {result.sites.length > 0 && (
            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-lg font-bold">Best places to keep looking</h2>
              <ul className="mt-3 space-y-2">
                {result.sites.map((s, i) => (
                  <li key={i} className="text-sm text-slate-300">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sky-400 hover:text-sky-300"
                    >
                      {s.name} ↗
                    </a>
                    {s.bestFor && <span className="text-slate-400"> — {s.bestFor}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.cautions && (
            <section className="rounded-2xl border border-amber-900 bg-amber-950/30 p-5">
              <h2 className="text-base font-bold text-amber-300">Before you wire money</h2>
              <p className="mt-2 text-sm text-amber-100/80">{result.cautions}</p>
            </section>
          )}

          {result.raw && (
            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-lg font-bold">Research notes</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{result.raw}</p>
            </section>
          )}

          <p className="text-xs text-slate-500">
            Listings, prices, and history are AI-researched from public sources
            and can be wrong or stale — always verify with the seller and get an
            independent pre-buy inspection. Import estimates are planning
            figures, not quotes.
          </p>
        </div>
      )}
    </main>
  );
}
