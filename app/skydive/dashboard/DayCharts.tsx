"use client";

import { useEffect, useState } from "react";

/**
 * Small-multiple hourly charts for one selected day: wind/gusts, cloud/precip,
 * and temperature — each on its own axis (never dual-axis), with the user's
 * limits drawn as dashed reference lines and hours outside the limits shaded.
 *
 * Compact charts are an overview (mouse hover still shows the crosshair);
 * tapping/clicking one opens it FULL-SCREEN with every hour labeled and a
 * touch-friendly crosshair. Real browser fullscreen is requested where
 * supported (Android Chrome), falling back to a fixed overlay (iOS).
 *
 * Colors are fixed per metric (categorical slots validated for CVD + contrast
 * against the slate-900 chart surface); text and axes wear ink tokens, never
 * series colors.
 */

interface ChartHour {
  localHour: number;
  safe: boolean;
  tempF: number | null;
  windMph: number | null;
  gustMph: number | null;
  cloudPct: number | null;
  precipPct: number | null;
}

interface Limits {
  maxWindMph: number;
  maxGustMph: number;
  maxPrecipPct: number;
  maxCloudPct: number;
  minTempF: number;
  maxTempF: number;
}

// Dark-mode categorical slots + chart chrome (validated on #0f172a).
const C = {
  wind: "#3987e5",
  gust: "#d95926",
  cloud: "#199e70",
  precip: "#c98500",
  temp: "#d55181",
  grid: "#2c2c2a",
  axis: "#383835",
  muted: "#898781",
  ink: "#c3c2b7",
  unsafe: "rgba(208,59,59,0.12)", // status-critical wash for out-of-limits hours
};

function fmtHour(h: number): string {
  const ampm = h >= 12 ? "pm" : "am";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${ampm}`;
}

interface Series {
  name: string;
  color: string;
  values: (number | null)[];
}

interface LimitLine {
  label: string;
  value: number;
}

interface ChartSpec {
  key: string;
  title: string;
  unit: string;
  series: Series[];
  limits: LimitLine[];
  yDomain: [number, number];
}

// --- One chart (renders compact or expanded) ---------------------------------

const W = 600;

function HourChart({
  spec,
  hours,
  expanded,
  hoverIdx,
  onHover,
  onExpand,
}: {
  spec: ChartSpec;
  hours: ChartHour[];
  expanded: boolean;
  hoverIdx: number | null;
  onHover: (i: number | null) => void;
  onExpand?: () => void;
}) {
  const H = expanded ? 300 : 170;
  const M = expanded
    ? { l: 44, r: 26, t: 14, b: 30 }
    : { l: 40, r: 8, t: 10, b: 22 };
  const fs = expanded ? 13 : 10;

  const { series, limits, unit } = spec;
  const [yMin, yMax] = spec.yDomain;
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const x = (i: number) =>
    M.l + (hours.length === 1 ? iw / 2 : (i / (hours.length - 1)) * iw);
  const y = (v: number) => M.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
  const colW = hours.length > 1 ? iw / (hours.length - 1) : iw;

  // Build each series path, breaking segments at missing hours.
  function pathFor(values: (number | null)[]): string {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  const gridVals = [0.25, 0.5, 0.75].map((f) => yMin + f * (yMax - yMin));
  // Expanded = the zoomed-in view: label EVERY hour.
  const tickEvery = expanded ? 1 : hours.length > 8 ? 3 : 2;

  function idxFromEvent(e: React.PointerEvent<SVGSVGElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - M.l) / iw) * (hours.length - 1));
    return Math.max(0, Math.min(hours.length - 1, i));
  }

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    // Compact charts: only mouse hover tracks the crosshair — a finger drag
    // would fight page scrolling, and a tap is reserved for expanding.
    if (!expanded && e.pointerType !== "mouse") return;
    onHover(idxFromEvent(e));
  }

  function handleDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!expanded && onExpand) {
      onExpand();
      return;
    }
    onHover(idxFromEvent(e));
  }

  const hover = hoverIdx != null ? hours[hoverIdx] : null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h4 className={`font-semibold text-slate-200 ${expanded ? "text-base" : "text-sm"}`}>
          {spec.title}
        </h4>
        {series.length > 1 && (
          <div className="flex gap-3 text-xs text-slate-400">
            {series.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.name}
              </span>
            ))}
          </div>
        )}
        {!expanded && (
          <span className="ml-auto text-xs text-sky-400">⛶ tap to zoom</span>
        )}
      </div>
      <div className="relative mt-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full select-none ${expanded ? "touch-none" : ""}`}
          onPointerMove={handleMove}
          onPointerDown={handleDown}
          onPointerLeave={() => onHover(null)}
          role="img"
          aria-label={`${spec.title} by hour; values are also in the table below`}
        >
          {/* out-of-limits hour shading */}
          {hours.map((h, i) =>
            h.safe ? null : (
              <rect
                key={i}
                x={x(i) - colW / 2}
                y={M.t}
                width={colW}
                height={ih}
                fill={C.unsafe}
              />
            )
          )}
          {/* gridlines + y labels */}
          {gridVals.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke={C.grid} strokeWidth={1} />
              <text x={M.l - 6} y={y(v) + 3} textAnchor="end" fontSize={fs} fill={C.muted}>
                {Math.round(v)}
              </text>
            </g>
          ))}
          {/* baseline + x ticks */}
          <line x1={M.l} x2={W - M.r} y1={M.t + ih} y2={M.t + ih} stroke={C.axis} strokeWidth={1} />
          {hours.map((h, i) =>
            i % tickEvery === 0 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={fs} fill={C.muted}>
                {expanded ? fmtHour(h.localHour) : fmtHour(h.localHour)}
              </text>
            ) : null
          )}
          {/* limit reference lines */}
          {limits.map((l) =>
            l.value >= yMin && l.value <= yMax ? (
              <g key={l.label}>
                <line
                  x1={M.l}
                  x2={W - M.r}
                  y1={y(l.value)}
                  y2={y(l.value)}
                  stroke={C.muted}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
                <text
                  x={W - M.r - 2}
                  y={y(l.value) - 4}
                  textAnchor="end"
                  fontSize={expanded ? 11 : 9}
                  fill={C.muted}
                >
                  {l.label}
                </text>
              </g>
            ) : null
          )}
          {/* series lines */}
          {series.map((s) => (
            <path key={s.name} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth={2} />
          ))}
          {/* expanded view: a dot on every hour so single hours are tappable targets */}
          {expanded &&
            series.map((s) =>
              s.values.map((v, i) =>
                v == null ? null : (
                  <circle key={`${s.name}-${i}`} cx={x(i)} cy={y(v)} r={3} fill={s.color} />
                )
              )
            )}
          {/* hover crosshair + markers */}
          {hoverIdx != null && (
            <g>
              <line
                x1={x(hoverIdx)}
                x2={x(hoverIdx)}
                y1={M.t}
                y2={M.t + ih}
                stroke={C.muted}
                strokeWidth={1}
              />
              {series.map((s) => {
                const v = s.values[hoverIdx];
                return v == null ? null : (
                  <circle
                    key={s.name}
                    cx={x(hoverIdx)}
                    cy={y(v)}
                    r={expanded ? 5 : 4}
                    fill={s.color}
                    stroke="#0f172a"
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          )}
        </svg>
        {/* tooltip */}
        {hover && hoverIdx != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-md border border-slate-700 bg-slate-950/95 px-2.5 py-1.5 text-xs text-slate-300 shadow-lg"
            style={
              hoverIdx < hours.length / 2
                ? { left: `${(x(hoverIdx) / W) * 100}%`, marginLeft: 10 }
                : { right: `${100 - (x(hoverIdx) / W) * 100}%`, marginRight: 10 }
            }
          >
            <p className="font-semibold text-slate-200">
              {fmtHour(hover.localHour)}
              {!hover.safe && <span className="ml-1.5 text-red-400">✗ outside limits</span>}
            </p>
            {series.map((s) => {
              const v = s.values[hoverIdx];
              return (
                <p key={s.name} className="mt-0.5 flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}: {v == null ? "—" : `${Math.round(v)}${unit}`}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Full-screen viewer -------------------------------------------------------

function FullscreenChart({
  spec,
  hours,
  onClose,
}: {
  spec: ChartSpec;
  hours: ChartHour[];
  onClose: () => void;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Fit the chart to the screen: use whichever of width/height binds, so the
  // whole chart (and the Close button) is always visible with no scrolling —
  // portrait letterboxes horizontally-bound, landscape height-bound.
  const [fitWidth, setFitWidth] = useState<number | null>(null);

  useEffect(() => {
    const ASPECT = 600 / 300; // expanded chart viewBox W/H
    const CHROME = 120; // header row + chart title row + padding
    const compute = () => {
      const vw = (window.visualViewport?.width ?? window.innerWidth) - 24;
      const vh = (window.visualViewport?.height ?? window.innerHeight) - CHROME;
      setFitWidth(Math.max(280, Math.min(vw, vh * ASPECT)));
    };
    compute();
    window.addEventListener("resize", compute);
    window.visualViewport?.addEventListener("resize", compute);
    const onFsChange = () => {
      if (!document.fullscreenElement) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", compute);
      window.visualViewport?.removeEventListener("resize", compute);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("keydown", onKey);
      (screen.orientation as any)?.unlock?.();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 p-3"
      style={{ height: "100dvh" }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="text-xs text-slate-400">Drag for exact hourly values</p>
        <button
          onClick={onClose}
          aria-label="Close full-screen chart"
          className="rounded-lg border border-slate-600 px-4 py-1.5 font-semibold text-slate-200 hover:border-sky-500"
        >
          ✕ Close
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div style={{ width: fitWidth ?? "100%" }}>
          <HourChart
            spec={spec}
            hours={hours}
            expanded
            hoverIdx={hoverIdx}
            onHover={setHoverIdx}
          />
        </div>
      </div>
    </div>
  );
}

// --- The day panel: three stacked charts + fullscreen state -------------------

export default function DayCharts({
  hours,
  limits,
}: {
  hours: ChartHour[];
  limits: Limits;
}) {
  // One shared hover index so the crosshair tracks across all three charts.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (hours.length === 0) {
    return <p className="text-sm text-slate-400">No hourly data for this day yet.</p>;
  }

  const maxOf = (vals: (number | null)[], ...also: number[]) =>
    Math.max(...vals.filter((v): v is number => v != null), ...also);
  const minOf = (vals: (number | null)[], ...also: number[]) =>
    Math.min(...vals.filter((v): v is number => v != null), ...also);

  const wind = hours.map((h) => h.windMph);
  const gust = hours.map((h) => h.gustMph);
  const cloud = hours.map((h) => h.cloudPct);
  const precip = hours.map((h) => h.precipPct);
  const temp = hours.map((h) => h.tempF);

  const windMax = Math.ceil(maxOf([...wind, ...gust], limits.maxGustMph) * 1.15);
  const tempPad = 6;
  const tempMin = Math.floor(minOf(temp, limits.minTempF) - tempPad);
  const tempMax = Math.ceil(maxOf(temp, Math.min(limits.maxTempF, 110)) + tempPad);

  const charts: ChartSpec[] = [
    {
      key: "wind",
      title: "Wind & gusts",
      unit: " mph",
      series: [
        { name: "Wind", color: C.wind, values: wind },
        { name: "Gusts", color: C.gust, values: gust },
      ],
      limits: [
        { label: `wind limit ${limits.maxWindMph}`, value: limits.maxWindMph },
        { label: `gust limit ${limits.maxGustMph}`, value: limits.maxGustMph },
      ],
      yDomain: [0, windMax],
    },
    {
      key: "sky",
      title: "Cloud cover & rain chance",
      unit: "%",
      series: [
        { name: "Cloud cover", color: C.cloud, values: cloud },
        { name: "Rain chance", color: C.precip, values: precip },
      ],
      limits: [
        { label: `cloud limit ${limits.maxCloudPct}`, value: limits.maxCloudPct },
        { label: `rain limit ${limits.maxPrecipPct}`, value: limits.maxPrecipPct },
      ],
      yDomain: [0, 100],
    },
    {
      key: "temp",
      title: "Temperature",
      unit: "°F",
      series: [{ name: "Temperature", color: C.temp, values: temp }],
      limits: [
        { label: `min ${limits.minTempF}`, value: limits.minTempF },
        ...(limits.maxTempF <= tempMax
          ? [{ label: `max ${limits.maxTempF}`, value: limits.maxTempF }]
          : []),
      ],
      yDomain: [tempMin, tempMax],
    },
  ];

  const expanded = charts.find((c) => c.key === expandedKey);

  function openFullscreen(key: string) {
    setExpandedKey(key);
    // Request real fullscreen synchronously with the tap so the browser still
    // sees the user activation (a deferred request often gets denied). The
    // fixed overlay is the fallback wherever this is unsupported (iOS).
    document.documentElement.requestFullscreen?.().then(
      () => (screen.orientation as any)?.lock?.("landscape").catch(() => {}),
      () => {}
    );
  }

  return (
    <div className="space-y-6">
      {charts.map((spec) => (
        <HourChart
          key={spec.key}
          spec={spec}
          hours={hours}
          expanded={false}
          hoverIdx={hoverIdx}
          onHover={setHoverIdx}
          onExpand={() => openFullscreen(spec.key)}
        />
      ))}
      <p className="text-xs text-slate-500">
        Red-shaded hours fall outside your limits (dashed lines). Tap any chart
        to zoom it full-screen with every hour labeled — the full numbers are
        also in the table below.
      </p>
      {expanded && (
        <FullscreenChart
          spec={expanded}
          hours={hours}
          onClose={() => setExpandedKey(null)}
        />
      )}
    </div>
  );
}
