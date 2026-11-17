import type { Metadata } from "next";
import { GameFooter, GameHeader, SUPPORT_EMAIL, Section } from "../_shared/GameChrome";

export const metadata: Metadata = {
  title: "Festival Freaks Privacy Policy — The Hearth & Hollow",
  description: "How the Festival Freaks game uses your Epic Games account data. No analytics, no chat, saves stay on the host's PC.",
};

const EFFECTIVE = "November 17, 2026";

export default function FestivalFreaksPrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <GameHeader />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 sm:py-12 w-full">
        <h2 className="text-3xl sm:text-4xl font-bold text-brandDark mb-2">Festival Freaks Privacy Policy</h2>
        <p className="text-themeMuted mb-8">
          <strong>The Hearth &amp; Hollow LLC</strong> · Effective: {EFFECTIVE}
        </p>

        <div className="space-y-3 text-themeText leading-relaxed mb-8">
          <p>
            This policy covers the game <strong>Festival Freaks</strong> (&ldquo;the game&rdquo;), developed and published by
            The Hearth &amp; Hollow LLC (&ldquo;we,&rdquo; &ldquo;us&rdquo;). It explains what information the game uses,
            why, and what it doesn&apos;t do. Our website and other services have their own{" "}
            <a href="/privacy" className="text-brand underline hover:text-brandDark">privacy policy</a>.
          </p>
        </div>

        <Section title="The short version">
          <ul className="list-disc pl-6 space-y-2">
            <li>You sign in with your Epic Games account so you can play online with friends.</li>
            <li>The game reads your Epic account ID, display name, online status and friends list, only to show who&apos;s playing and to send or accept co-op invites.</li>
            <li>There is no voice chat and no text chat with other players.</li>
            <li>There are no analytics and no crash reporting beyond the game engine&apos;s logs on your own computer.</li>
            <li>Saved games stay on the host&apos;s PC. We don&apos;t keep personal data on any server.</li>
          </ul>
        </Section>

        <Section title="Information the game uses">
          <p>
            When you sign in through <strong>Epic Online Services (EOS)</strong>, Epic Games shares the following with the
            game, with your permission:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Epic account ID</strong>: to identify you to the other players in your session.</li>
            <li><strong>Display name</strong>: shown to the people you play with.</li>
            <li><strong>Online presence</strong>: to show whether you and your friends are online or in a game.</li>
            <li><strong>Friends list</strong>: so you can invite friends to a co-op session and see their invites.</li>
          </ul>
          <p>
            This information is used inside the game while you play. We don&apos;t sell it, use it for advertising, or copy
            it to servers of our own.
          </p>
        </Section>

        <Section title="Online play">
          <p>
            Up to four players connect to each other directly (peer to peer), using Epic&apos;s relay service where a direct
            connection isn&apos;t possible. The players in your session can see your display name and what you do in the game.
            The game has no voice or text chat.
          </p>
        </Section>

        <Section title="Saved games and logs">
          <p>
            Saved games are stored on the hosting player&apos;s PC. The game engine may write diagnostic logs to your own
            computer to help troubleshoot problems; they stay on your computer unless you choose to send them to us.
          </p>
        </Section>

        <Section title="Epic Games">
          <p>
            Signing in, friends, presence and the relay are provided by Epic Games, Inc. Epic&apos;s handling of your account
            data is covered by{" "}
            <a href="https://www.epicgames.com/site/privacypolicy" className="text-brand underline hover:text-brandDark">
              Epic Games&apos; privacy policy
            </a>
            . You can manage your Epic account, friends and privacy settings on the Epic Games website.
          </p>
        </Section>

        <Section title="Children">
          <p>
            The game isn&apos;t directed to children under 13, and we don&apos;t knowingly collect information from them.
            Epic Games applies its own age and parental-control rules to Epic accounts.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can stop using online features by signing out of Epic in the game, and you can remove the game&apos;s
            access to your Epic account from your Epic account settings. Because we don&apos;t keep personal data on our own
            servers, there&apos;s nothing for us to delete. If you have questions or a request, email us.
          </p>
        </Section>

        <Section title="Changes">
          <p>We may update this policy as the game develops; the effective date above will change when we do.</p>
        </Section>

        <Section title="Contact">
          <p>
            The Hearth &amp; Hollow LLC · North Carolina, USA
            <br />
            Email:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand underline hover:text-brandDark">{SUPPORT_EMAIL}</a>
          </p>
        </Section>
      </main>
      <GameFooter />
    </div>
  );
}
