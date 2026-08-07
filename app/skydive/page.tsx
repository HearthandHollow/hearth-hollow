import SignupForm from "./SignupForm";

const CHECKS = [
  {
    title: "Wind & gusts",
    desc: "Sustained wind and gust limits you set, checked hour by hour.",
  },
  {
    title: "Clouds & ceiling",
    desc: "Sky cover percentage and cloud-ceiling height against your minimums.",
  },
  {
    title: "Rain & storms",
    desc: "Precipitation chance limits — and thunderstorms are always a no-go.",
  },
  {
    title: "Temperature",
    desc: "Too cold at altitude or dangerously hot on the ground? We flag it.",
  },
];

export default function SkydiveLandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">
          Skydive Weather
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Is it safe to jump today?
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
          We watch the National Weather Service forecast for your drop zone and
          make an automatic go / no-go call against <em>your</em> personal
          limits — wind, gusts, clouds, ceiling, rain, and temperature. Get a
          daily email outlook and an hour-by-hour dashboard.
        </p>
      </header>

      <div className="mt-14 grid gap-10 lg:grid-cols-2">
        <section className="grid content-start gap-4 sm:grid-cols-2">
          {CHECKS.map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
            >
              <h3 className="font-semibold text-sky-300">{c.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{c.desc}</p>
            </div>
          ))}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:col-span-2">
            <h3 className="font-semibold text-sky-300">How it works</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-400">
              <li>Sign up with your email and your area (US locations).</li>
              <li>We email you a personal dashboard link — no password.</li>
              <li>Tune your safety limits to match your experience level.</li>
              <li>Every morning: a go / no-go email for the days ahead.</li>
            </ol>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
          <h2 className="text-xl font-bold">Sign up for your area</h2>
          <p className="mt-1 text-sm text-slate-400">
            Free go / no-go monitoring. Already signed up? Enter your email and
            we&apos;ll re-send your dashboard link.
          </p>
          <SignupForm />
        </section>
      </div>

      <footer className="mt-16 text-center text-xs text-slate-500">
        Forecast data: National Weather Service (weather.gov). This is a
        planning aid — always confirm conditions with your drop zone and
        instructors before jumping.
      </footer>
    </main>
  );
}
