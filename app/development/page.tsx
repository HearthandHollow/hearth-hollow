import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Website & App Development — The Hearth & Hollow",
  description:
    "Custom websites, online scheduling, customer portals, mobile apps, and AI-powered automation for small businesses, trades, and homesteads — built and hosted by The Hearth & Hollow in Salisbury, NC.",
};

const REQUEST_HREF = "/request?category=Website%20%26%20App%20Development";

const OFFERINGS = [
  {
    icon: "🌐",
    title: "Business Websites",
    body: "A fast, modern site that looks right on a phone and shows up on Google. Built for trades, practices, and small shops that need to be found and trusted — not a template with your name pasted in.",
  },
  {
    icon: "📅",
    title: "Online Scheduling & Bookings",
    body: "Let customers book appointments, request quotes, or reserve time from your site, with confirmations by email and text and a calendar you actually control.",
  },
  {
    icon: "🔐",
    title: "Customer & Staff Portals",
    body: "Secure logins for customers to see their history and invoices, and admin dashboards for you and your staff to manage the work behind the scenes.",
  },
  {
    icon: "💳",
    title: "Online Payments & Invoicing",
    body: "Stripe-powered bill pay, deposits, subscriptions, and recurring invoices so getting paid stops being a chore.",
  },
  {
    icon: "📱",
    title: "Mobile Apps (iOS & Android)",
    body: "Cross-platform apps published to the App Store and Google Play — the same team that ships RackerTracker, our own pool tournament app, can ship yours.",
  },
  {
    icon: "🤖",
    title: "AI Agents & Automation",
    body: "Voice agents that answer your phone, quote assistants that read project photos, and automations that move the paperwork — the same tools that run this business, put to work for yours.",
  },
];

const PROCESS = [
  {
    step: "1",
    title: "Tell us what you need",
    body: "Send a request with what your business does and what's not working today. No technical language required.",
  },
  {
    step: "2",
    title: "Get a plain-English proposal",
    body: "Within 24 hours you'll have a scope, a fixed price or a clear hourly range, and a timeline.",
  },
  {
    step: "3",
    title: "We build, you review",
    body: "You see a live preview as it comes together. Nothing goes public until you've approved it.",
  },
  {
    step: "4",
    title: "Launch and care",
    body: "We host it, keep it updated, watch uptime, and make changes when your business changes — on a simple monthly care plan.",
  },
];

export default function DevelopmentPage() {
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "The Hearth & Hollow";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-themeBorder sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between sm:items-center">
          <div className="min-w-0">
            <Link href="/" className="block">
              <h1 className="text-xl sm:text-2xl font-bold text-brand break-words">{companyName}</h1>
            </Link>
            <p className="text-xs sm:text-sm text-themeMuted">Crafted for Self-Sufficiency • Built to Last</p>
          </div>
          <nav className="flex flex-wrap gap-2 sm:gap-4 items-center">
            <Link href="/gallery" className="px-3 sm:px-4 py-2 text-sm sm:text-base text-themeMuted hover:text-themeText">
              Our Work
            </Link>
            <Link href="/development" className="px-3 sm:px-4 py-2 text-sm sm:text-base text-brandDark font-semibold">
              Web &amp; Apps
            </Link>
            <Link href={REQUEST_HREF} className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-brand text-white rounded-lg hover:bg-brandDark">
              Request Quote
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-amber-50 border-b border-brand">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand mb-3">Website &amp; App Development</p>
          <h2 className="text-3xl sm:text-5xl font-bold text-brandDark mb-4 max-w-3xl">
            Digital craft for businesses that work with their hands.
          </h2>
          <p className="text-base sm:text-lg text-themeMuted mb-8 max-w-2xl">
            We build the same way we build everything else: real materials, honest joinery, no shortcuts. Websites, online scheduling, customer portals, mobile apps, and AI automation — designed for trades, small practices, and homesteads, and cared for after launch.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={REQUEST_HREF}
              className="inline-block px-6 py-3 bg-brand text-white rounded-lg hover:bg-brandDark text-lg shadow-lg"
            >
              Start a Project →
            </Link>
            <a
              href="#what-we-build"
              className="inline-block px-6 py-3 border border-brand text-brandDark rounded-lg hover:bg-white text-lg"
            >
              See what we build
            </a>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:py-12 w-full">
        {/* What we build */}
        <section id="what-we-build" className="my-4 sm:my-8">
          <h3 className="text-2xl font-bold text-brandDark mb-2">What we build</h3>
          <p className="text-themeMuted mb-6 max-w-2xl">
            Every project is scoped to what your business actually needs. Start with a website and add scheduling, portals, or an app when you&apos;re ready — it all runs on the same foundation.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {OFFERINGS.map((o) => (
              <div key={o.title} className="bg-white p-6 rounded-lg border border-themeBorder">
                <div className="text-3xl mb-2">{o.icon}</div>
                <h4 className="text-lg font-semibold text-brandDark mb-2">{o.title}</h4>
                <p className="text-themeMuted text-sm">{o.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Built and run by us */}
        <section className="grid md:grid-cols-2 gap-6 sm:gap-10 items-center my-12">
          <div>
            <h3 className="text-2xl font-bold text-brandDark mb-3">We run on what we build</h3>
            <p className="text-themeMuted mb-3">
              This site is one of ours. The quote system that reads your project photos and drafts an estimate, the scheduling and invoicing behind the scenes, the voice agent that answers our line — all built in-house and used every day.
            </p>
            <p className="text-themeMuted mb-3">
              RackerTracker, our pool-tournament app for bars and leagues, is live on the App Store and Google Play. And we build and host sites for other local businesses — a cash-pay medical practice with online scheduling and a staff portal, and a farrier service with customer profiles and online bill pay.
            </p>
            <p className="text-themeMuted">
              When something breaks at 2 a.m., we&apos;re the ones who notice — because we&apos;re watching our own uptime too.
            </p>
          </div>
          <div className="bg-amber-50 border border-brand rounded-lg p-6 sm:p-8">
            <h4 className="font-semibold text-brandDark mb-4">Good fit for</h4>
            <ul className="space-y-2 text-themeMuted text-sm">
              <li>• Trades and contractors who need quotes, scheduling, and a site that earns trust</li>
              <li>• Clinics, practices, and services that take appointments</li>
              <li>• Farriers, vets, and mobile services with customers and animals to track</li>
              <li>• Bars, leagues, and clubs that run events or tournaments</li>
              <li>• Homesteads and small farms selling direct or managing operations</li>
              <li>• Anyone tired of paying for a website builder that never quite fits</li>
            </ul>
          </div>
        </section>

        {/* Process */}
        <section className="my-12">
          <h3 className="text-2xl font-bold text-brandDark mb-6">How it works</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROCESS.map((p) => (
              <div key={p.step} className="bg-white p-6 rounded-lg border border-themeBorder">
                <div className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center font-bold mb-3">
                  {p.step}
                </div>
                <h4 className="font-semibold text-brandDark mb-2">{p.title}</h4>
                <p className="text-themeMuted text-sm">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="bg-themeBg border border-themeBorder rounded-lg p-5 sm:p-8 my-12">
          <h3 className="text-2xl font-bold text-themeText mb-3">Straight pricing</h3>
          <p className="text-themeMuted mb-4">
            Most website projects are quoted as a fixed price after a short conversation, so there are no surprises. Larger builds — portals, apps, integrations — are scoped in phases with a clear estimate for each. Hosting, updates, backups, and uptime monitoring are bundled into a simple monthly care plan, and you always own your domain, your code, and your data.
          </p>
          <Link href={REQUEST_HREF} className="inline-block px-6 py-3 bg-brand text-white rounded-lg hover:bg-brandDark shadow">
            Request a proposal →
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-amber-50 border-t border-brand mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-brandDark">
          <p>&copy; 2026 {companyName}. All rights reserved.</p>
          <p className="text-sm text-themeMuted mt-2">Crafted for Self-Sufficiency • Built to Last</p>
        </div>
      </footer>
    </div>
  );
}
