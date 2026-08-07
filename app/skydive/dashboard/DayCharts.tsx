"use client";

import { useState } from "react";

/**
 * Small-multiple hourly charts for one selected day: wind/gusts, cloud/precip,
 * and temperature — each on its own axis (never dual-axis), with the user's
 * limits drawn as dashed reference lines and hours outside the limits shaded.
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

// --- One mini chart ----------------------------------------------------------

const W = 600;
const H = 170;
const M = { l: 40, r: 8, t: 10, b: 22 };

function MiniChart({
  title,
  unit,
  hours,
  series,
  limits,
  yDomain,
  hoverIdx,
  onHover,
}: {
  title: string;
  unit: string;
  hours: ChartHour[];
  series: Series[];
  limits: LimitLine[];
  yDomain: [number, number];
  hoverIdx: number | null;
  onHover: (i: number | null) => void;
}) {
  const [yMin, yMax] = yDomain;
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
  const tickEvery = hours.length > 8 ? 3 : 2;

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - M.l) / iw) * (hours.length - 1));
    onHover(Math.max(0, Math.min(hours.length - 1, i)));
  }

  const hover = hoverIdx != null ? hours[hoverIdx] : null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
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
      </div>
      <div className="relative mt-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => onHover(null)}
          role="img"
          aria-label={`${title} by hour; values are also in the table below`}
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
              <text x={M.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill={C.muted}>
                {Math.round(v)}
              </text>
            </g>
          ))}
          {/* baseline + x ticks */}
          <line x1={M.l} x2={W - M.r} y1={M.t + ih} y2={M.t + ih} stroke={C.axis} strokeWidth={1} />
          {hours.map((h, i) =>
            i % tickEvery === 0 ? (
              <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill={C.muted}>
                {fmtHour(h.localHour)}
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
                  fontSize={9}
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
                    r={4}
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

// --- The day panel: three stacked mini charts --------------------------------

export default function DayCharts({
  hours,
  limits,
}: {
  hours: ChartHour[];
  limits: Limits;
}) {
  // One shared hover index so the crosshair tracks across all three charts.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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

  return (
    <div className="space-y-6">
      <MiniChart
        title="Wind & gusts"
        unit=" mph"
        hours={hours}
        series={[
          { name: "Wind", color: C.wind, values: wind },
          { name: "Gusts", color: C.gust, values: gust },
        ]}
        limits={[
          { label: `wind limit ${limits.maxWindMph}`, value: limits.maxWindMph },
          { label: `gust limit ${limits.maxGustMph}`, value: limits.maxGustMph },
        ]}
        yDomain={[0, windMax]}
        hoverIdx={hoverIdx}
        onHover={setHoverIdx}
      />
      <MiniChart
        title="Cloud cover & rain chance"
        unit="%"
        hours={hours}
        series={[
          { name: "Cloud cover", color: C.cloud, values: cloud },
          { name: "Rain chance", color: C.precip, values: precip },
        ]}
        limits={[
          { label: `cloud limit ${limits.maxCloudPct}`, value: limits.maxCloudPct },
          { label: `rain limit ${limits.maxPrecipPct}`, value: limits.maxPrecipPct },
        ]}
        yDomain={[0, 100]}
        hoverIdx={hoverIdx}
        onHover={setHoverIdx}
      />
      <MiniChart
        title="Temperature"
        unit="°F"
        hours={hours}
        series={[{ name: "Temperature", color: C.temp, values: temp }]}
        limits={[
          { label: `min ${limits.minTempF}`, value: limits.minTempF },
          ...(limits.maxTempF <= tempMax
            ? [{ label: `max ${limits.maxTempF}`, value: limits.maxTempF }]
            : []),
        ]}
        yDomain={[tempMin, tempMax]}
        hoverIdx={hoverIdx}
        onHover={setHoverIdx}
      />
      <p className="text-xs text-slate-500">
        Red-shaded hours fall outside your limits (dashed lines). Tap or hover a
        chart for exact values — the full numbers are also in the table below.
      </p>
    </div>
  );
}
