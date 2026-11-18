import type { Metadata } from "next";
import { GameFooter, GameHeader, Section } from "../festival-freaks/_shared/GameChrome";
import { FESTIVAL_FREAKS_RELEASES, countFestivalFreaksHit, latestFestivalFreaksRelease } from "@/lib/festival-freaks-releases";

export const metadata: Metadata = {
  title: "Download Festival Freaks — The Hearth & Hollow",
  description: "Get the latest Festival Freaks build, see what's new and how to update.",
};

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

// Rendered per request so each visit can be counted.
export const dynamic = "force-dynamic";

export default function FestivalFreaksDownloadPage() {
  countFestivalFreaksHit("page_view");
  const latest = latestFestivalFreaksRelease;
  const older = FESTIVAL_FREAKS_RELEASES.slice(1);

  return (
    <div className="min-h-screen flex flex-col">
      <GameHeader />

      <section className="bg-amber-50 border-b border-brand">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-16">
          <h2 className="text-3xl sm:text-5xl font-bold text-brandDark mb-3">Festival Freaks</h2>
          <p className="text-base sm:text-lg text-themeMuted max-w-2xl">
            Run a music festival on foot, from the farm down the road to festivals off-world.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 sm:py-12 w-full">
        <section className="bg-white border-2 border-brand rounded-lg p-6 shadow-sm mb-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand mb-2">Latest version</p>
          <p className="text-2xl sm:text-3xl font-bold text-brandDark mb-1">v{latest.version}</p>
          <p className="text-themeMuted mb-6">
            Released {formatDate(latest.released)} · {latest.size}
          </p>
          <a
            href="/festivalfreaks/download"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full sm:w-auto text-center px-8 py-4 bg-brand text-white rounded-lg hover:bg-brandDark text-lg font-semibold shadow-lg"
          >
            Download v{latest.version}
          </a>
        </section>

        <Section title="What's new">
          <ul className="list-disc pl-6 space-y-2">
            {latest.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>

        <Section title="Install or update">
          <ol className="list-decimal pl-6 space-y-2">
            <li>Download the zip with the button above.</li>
            <li>Unzip it over your old Festival Freaks folder. Your saves are kept.</li>
            <li>Run <strong>Festival Freaks.exe</strong>.</li>
            <li>Sign in with Epic when asked. For now, friends you play with must be on the tester list.</li>
          </ol>
        </Section>

        {older.length > 0 && (
          <Section title="Earlier versions">
            <div className="space-y-6">
              {older.map((r) => (
                <div key={r.build}>
                  <h4 className="font-bold text-brandDark">
                    v{r.version} <span className="font-normal text-themeMuted">· {formatDate(r.released)}</span>
                  </h4>
                  <ul className="list-disc pl-6 space-y-1 mt-2">
                    {r.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        )}
      </main>

      <GameFooter />
    </div>
  );
}
