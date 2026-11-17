import type { Metadata } from "next";
import { GameFooter, GameHeader, SUPPORT_EMAIL } from "./_shared/GameChrome";

export const metadata: Metadata = {
  title: "Festival Freaks — a co-op festival management game by The Hearth & Hollow",
  description:
    "Festival Freaks (Fest Freaks) is a first-person, co-op music-festival management sim for up to 4 friends online. Build the stages, book the acts, keep the crowd happy and take the show on tour.",
};

const FEATURES = [
  { icon: "🎪", title: "Run the whole festival", body: "Lay out stages, food stalls and campsites, book the acts, set the schedule and keep everything running when the headliner is late and it starts to rain." },
  { icon: "🧑‍🤝‍🧑", title: "Co-op with up to 4 friends", body: "Split the jobs, or all panic together. Invite friends online and run the festival side by side, in first person, on the festival grounds." },
  { icon: "🚚", title: "Take it on tour", body: "Pack up, roll out and set up again in a new town. Every stop brings new crowds, new venues and new problems to solve." },
  { icon: "🎸", title: "Keep the crowd happy", body: "Lines, sound checks, lost tickets, mud. Read the crowd and fix problems before they turn into bad reviews." },
];

export default function FestivalFreaksPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <GameHeader />

      <section className="bg-amber-50 border-b border-brand">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand mb-3">Co-op festival management · In development</p>
          <h2 className="text-3xl sm:text-5xl font-bold text-brandDark mb-4 max-w-3xl">
            Build it. Book it. Survive the weekend.
          </h2>
          <p className="text-base sm:text-lg text-themeMuted mb-8 max-w-2xl">
            <strong>Festival Freaks</strong> (Fest Freaks for short) is a touring music-festival management sim you play in
            first person, with up to four friends online. You and your crew build the grounds, book the acts and keep the
            crowd happy, then pack up and take the whole show to the next town.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Festival%20Freaks`} className="inline-block px-6 py-3 bg-brand text-white rounded-lg hover:bg-brandDark text-lg shadow-lg">
              Contact the team
            </a>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:py-12 w-full">
        <section className="my-4 sm:my-8">
          <h3 className="text-2xl font-bold text-brandDark mb-6">What you&apos;ll do</h3>
          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white border border-themeBorder rounded-lg p-6 shadow-sm">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h4 className="text-lg font-bold text-brandDark mb-2">{f.title}</h4>
                <p className="text-themeMuted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="my-10 grid sm:grid-cols-2 gap-6">
          <div className="bg-white border border-themeBorder rounded-lg p-6">
            <h3 className="text-xl font-bold text-brandDark mb-3">The details</h3>
            <ul className="space-y-2 text-themeText">
              <li><strong>Players:</strong> 1–4, online co-op</li>
              <li><strong>View:</strong> first person</li>
              <li><strong>Online play:</strong> sign in with your Epic Games account to see friends and send or accept co-op invites</li>
              <li><strong>Status:</strong> in development</li>
              <li><strong>Developer &amp; publisher:</strong> The Hearth &amp; Hollow LLC</li>
            </ul>
          </div>
          <div className="bg-white border border-themeBorder rounded-lg p-6">
            <h3 className="text-xl font-bold text-brandDark mb-3">Your privacy</h3>
            <p className="text-themeText mb-3">
              Festival Freaks uses your Epic account only to show who&apos;s playing and to send co-op invites. There&apos;s
              no in-game voice or text chat, no analytics, and your saves stay on the host&apos;s PC.
            </p>
            <a href="/festival-freaks/privacy" className="text-brand underline hover:text-brandDark">Read the Festival Freaks privacy policy →</a>
          </div>
        </section>

        <section className="my-10 text-center">
          <p className="text-themeMuted">
            Questions, bug reports or press? Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand underline hover:text-brandDark">{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>

      <GameFooter />
    </div>
  );
}
