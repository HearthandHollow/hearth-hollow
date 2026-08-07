"use client";

/**
 * A small animated skydiver scene that reflects weather conditions: sky tone
 * follows the verdict, clouds thicken with cloud cover, wind streaks speed up
 * with wind, rain falls when precip chance is high, lightning flashes for
 * thunder, and vertical speed lines sell the freefall. Pure inline SVG + CSS
 * keyframes — no assets, ~90px square.
 */

export interface SceneConditions {
  windMph: number | null;
  cloudPct: number | null;
  precipPct: number | null;
  thunder: boolean;
  rating: "GOOD" | "LIMITED" | "NO_GO";
}

const SKY: Record<SceneConditions["rating"], [string, string]> = {
  GOOD: ["#0369a1", "#082f49"],
  LIMITED: ["#475569", "#0f172a"],
  NO_GO: ["#334155", "#020617"],
};

export default function SkydiverScene({
  windMph,
  cloudPct,
  precipPct,
  thunder,
  rating,
  label,
}: SceneConditions & { label?: string }) {
  const wind = Math.min(windMph ?? 0, 40);
  const windDur = Math.max(0.7, 3.5 - wind / 12); // more wind = faster streaks
  const clouds = cloudPct ?? 0;
  const raining = (precipPct ?? 0) >= 40;
  const sunny = clouds < 40 && !raining && !thunder;
  const [skyTop, skyBottom] = SKY[rating];

  return (
    <div
      className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl border border-slate-700"
      title={label || "Conditions"}
      aria-hidden="true"
    >
      <style>{`
        @keyframes sd-bob { from { transform: translateY(-2px) rotate(-4deg); } to { transform: translateY(2px) rotate(4deg); } }
        @keyframes sd-fall { 0% { transform: translateY(-25px); opacity: 0; } 25% { opacity: .55; } 100% { transform: translateY(95px); opacity: 0; } }
        @keyframes sd-wind { from { transform: translateX(95px); } to { transform: translateX(-115px); } }
        @keyframes sd-rain { from { transform: translateY(-25px); } to { transform: translateY(100px); } }
        @keyframes sd-drift { from { transform: translateX(-5px); } to { transform: translateX(5px); } }
        @keyframes sd-flash { 0%, 84%, 92%, 100% { opacity: 0; } 86%, 90% { opacity: 1; } }
      `}</style>
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <defs>
          <linearGradient id="sd-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={skyTop} />
            <stop offset="1" stopColor={skyBottom} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#sd-sky)" />

        {sunny && <circle cx="82" cy="16" r="9" fill="#fbbf24" opacity="0.9" />}

        {/* falling speed lines */}
        {[22, 50, 78].map((x, i) => (
          <line
            key={`f${i}`}
            x1={x}
            y1={-12}
            x2={x}
            y2={2}
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ animation: `sd-fall ${1.1 + i * 0.25}s linear ${i * 0.4}s infinite` }}
          />
        ))}

        {/* wind streaks */}
        {wind > 4 &&
          [30, 58, 82].map((y, i) => (
            <line
              key={`w${i}`}
              x1={0}
              y1={y}
              x2={16 + wind / 2}
              y2={y}
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.55"
              style={{ animation: `sd-wind ${windDur}s linear ${i * (windDur / 3)}s infinite` }}
            />
          ))}

        {/* skydiver: belly-to-earth spread, bobbing in the relative wind */}
        <g
          style={{
            animation: "sd-bob 1.6s ease-in-out infinite alternate",
            transformBox: "fill-box",
            transformOrigin: "center",
          }}
        >
          {/* arms */}
          <path d="M50 44 L38 36 M50 44 L62 36" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* legs */}
          <path d="M50 52 L40 62 M50 52 L60 62" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* body */}
          <rect x="46.5" y="41" width="7" height="13" rx="3.5" fill="#0ea5e9" />
          {/* head */}
          <circle cx="50" cy="36.5" r="4.5" fill="#fbbf24" />
          {/* goggles */}
          <rect x="46.5" y="34.5" width="7" height="2.5" rx="1.2" fill="#1e293b" />
        </g>

        {/* clouds — thicken with cover */}
        {clouds >= 25 && (
          <g
            fill="#e2e8f0"
            opacity={clouds >= 70 ? 0.85 : 0.5}
            style={{ animation: "sd-drift 5s ease-in-out infinite alternate" }}
          >
            <ellipse cx="24" cy="12" rx="16" ry="7" />
            <ellipse cx="38" cy="9" rx="12" ry="6" />
            {clouds >= 70 && <ellipse cx="72" cy="14" rx="18" ry="7" />}
          </g>
        )}

        {/* rain */}
        {raining &&
          [14, 34, 62, 86].map((x, i) => (
            <line
              key={`r${i}`}
              x1={x}
              y1={-8}
              x2={x - 4}
              y2={4}
              stroke="#7dd3fc"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ animation: `sd-rain ${0.9 + i * 0.15}s linear ${i * 0.22}s infinite` }}
            />
          ))}

        {/* lightning */}
        {thunder && (
          <polygon
            points="70,20 62,42 68,42 58,62 74,38 67,38 76,20"
            fill="#fde047"
            style={{ animation: "sd-flash 3s linear infinite" }}
          />
        )}
      </svg>
    </div>
  );
}
