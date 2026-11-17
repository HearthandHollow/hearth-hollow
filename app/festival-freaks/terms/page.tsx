import type { Metadata } from "next";
import { GameFooter, GameHeader, SUPPORT_EMAIL, Section } from "../_shared/GameChrome";

export const metadata: Metadata = {
  title: "Festival Freaks Terms of Service — The Hearth & Hollow",
  description: "Terms for playing Festival Freaks, a co-op festival management game by The Hearth & Hollow.",
};

const EFFECTIVE = "November 17, 2026";

export default function FestivalFreaksTermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <GameHeader />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 sm:py-12 w-full">
        <h2 className="text-3xl sm:text-4xl font-bold text-brandDark mb-2">Festival Freaks Terms of Service</h2>
        <p className="text-themeMuted mb-8">
          <strong>The Hearth &amp; Hollow LLC</strong> · Effective: {EFFECTIVE}
        </p>

        <Section title="Agreement">
          <p>
            These terms apply when you play <strong>Festival Freaks</strong> (&ldquo;the game&rdquo;), made by The Hearth
            &amp; Hollow LLC (&ldquo;we,&rdquo; &ldquo;us&rdquo;). By playing, you agree to them. If you don&apos;t agree,
            please don&apos;t play.
          </p>
        </Section>

        <Section title="Your license to play">
          <p>
            We give you a personal, non-exclusive, non-transferable license to install and play the game for your own
            non-commercial use. You may not resell, rent or redistribute the game, or reverse-engineer it except where the
            law allows. The game and its content belong to The Hearth &amp; Hollow LLC and its licensors.
          </p>
        </Section>

        <Section title="Epic Games account and online play">
          <p>
            Online co-op uses Epic Online Services and requires an Epic Games account. Your use of that account is also
            governed by Epic Games&apos; own terms. Be decent to the people you play with: don&apos;t cheat, exploit bugs to
            ruin others&apos; sessions, or use your display name to harass anyone. We may limit access to online features
            for players who do.
          </p>
        </Section>

        <Section title="Early development">
          <p>
            Festival Freaks is in development. Features may change, break or be removed, and saved games from early builds
            may not carry over to later versions.
          </p>
        </Section>

        <Section title="No warranty">
          <p>
            The game is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the extent the law allows, we make no
            warranties of any kind, and we aren&apos;t liable for indirect or consequential damages, lost data or lost
            saves arising from your use of the game.
          </p>
        </Section>

        <Section title="Privacy">
          <p>
            How the game uses your information is explained in the{" "}
            <a href="/festival-freaks/privacy" className="text-brand underline hover:text-brandDark">Festival Freaks privacy policy</a>.
          </p>
        </Section>

        <Section title="Changes and law">
          <p>
            We may update these terms; the effective date above will change when we do. These terms are governed by the
            laws of the State of North Carolina, USA.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Email:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand underline hover:text-brandDark">{SUPPORT_EMAIL}</a>
          </p>
        </Section>
      </main>
      <GameFooter />
    </div>
  );
}
