import Link from "next/link";

// Shared header/footer for the Festival Freaks pages (game page, privacy, terms).
// Publisher branding follows the main site; the game gets its own festival accent.
export const SUPPORT_EMAIL = "support@thehearthhollow.com";

export function GameHeader() {
  return (
    <header className="bg-white border-b border-themeBorder sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between sm:items-center">
        <div className="min-w-0">
          <Link href="/festival-freaks" className="block">
            <h1 className="text-xl sm:text-2xl font-bold text-brand break-words">Festival Freaks</h1>
          </Link>
          <p className="text-xs sm:text-sm text-themeMuted">
            A game by <Link href="/" className="underline hover:text-brand">The Hearth &amp; Hollow</Link>
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 sm:gap-4 items-center">
          <Link href="/festival-freaks" className="px-3 sm:px-4 py-2 text-sm sm:text-base text-themeMuted hover:text-themeText">
            Game
          </Link>
          <Link href="/festival-freaks/privacy" className="px-3 sm:px-4 py-2 text-sm sm:text-base text-themeMuted hover:text-themeText">
            Privacy
          </Link>
          <Link href="/festival-freaks/terms" className="px-3 sm:px-4 py-2 text-sm sm:text-base text-themeMuted hover:text-themeText">
            Terms
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function GameFooter() {
  return (
    <footer className="bg-amber-50 border-t border-brand mt-12">
      <div className="max-w-6xl mx-auto px-4 py-8 text-center text-brandDark space-y-2">
        <p>
          &copy; 2026 The Hearth &amp; Hollow LLC. Festival Freaks is developed and published by The Hearth &amp; Hollow.
        </p>
        <p className="text-sm">
          <Link href="/festival-freaks/privacy" className="underline hover:text-brand">Privacy Policy</Link>
          {" · "}
          <Link href="/festival-freaks/terms" className="underline hover:text-brand">Terms of Service</Link>
          {" · "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-brand">{SUPPORT_EMAIL}</a>
        </p>
        <p className="text-xs text-themeMuted">
          Epic, Epic Games and Epic Online Services are trademarks of Epic Games, Inc. Festival Freaks is not
          affiliated with or endorsed by Epic Games.
        </p>
      </div>
    </footer>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="text-xl sm:text-2xl font-bold text-brandDark mb-3">{title}</h3>
      <div className="space-y-3 text-themeText leading-relaxed">{children}</div>
    </section>
  );
}
