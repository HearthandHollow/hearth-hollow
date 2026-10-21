import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — The Hearth & Hollow",
  description:
    "How The Hearth & Hollow LLC collects, uses and protects your information across our website, services, WhatsApp messaging and the RackerTracker app.",
};

const EFFECTIVE = "October 21, 2026";
const CONTACT_EMAIL = "hunterhammond@thehearthhollow.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="text-xl sm:text-2xl font-bold text-brandDark mb-3">{title}</h3>
      <div className="space-y-3 text-themeText leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
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
            <Link href="/" className="px-3 sm:px-4 py-2 text-sm sm:text-base text-themeMuted hover:text-themeText">
              Home
            </Link>
            <Link href="/request" className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-brand text-white rounded-lg hover:bg-brandDark">
              Request Quote
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 sm:py-12 w-full">
        <h2 className="text-3xl sm:text-4xl font-bold text-brandDark mb-2">Privacy Policy</h2>
        <p className="text-themeMuted mb-8">
          <strong>The Hearth &amp; Hollow LLC</strong> · Effective: {EFFECTIVE}
        </p>

        <div className="space-y-3 text-themeText leading-relaxed mb-8">
          <p>
            The Hearth &amp; Hollow LLC (&ldquo;we,&rdquo; &ldquo;us&rdquo;) runs thehearthhollow.com, our handyman,
            fabrication and homestead services, the RackerTracker app, and related websites we build and host. This
            policy explains what information we collect, how we use it, and the choices you have.
          </p>
        </div>

        <Section title="Information we collect">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Information you give us</strong> — name, email, phone number, project address, project details
              and photos when you request a quote, book a service, place an order, or contact us.
            </li>
            <li>
              <strong>Messages</strong> — the content of emails, SMS, phone calls and WhatsApp messages you send us,
              including photos or files you attach. Calls to our business line may be answered by an automated
              assistant and recorded or transcribed so we can respond to your request.
            </li>
            <li>
              <strong>RackerTracker</strong> — account details (name, email, display name), tournament, match and
              score data you or your organizer enter, and basic app diagnostics. The app also has its own{" "}
              <a href="https://racker-tracker.com/privacy-policy.html" className="text-brand underline hover:text-brandDark">
                RackerTracker privacy policy
              </a>
              .
            </li>
            <li>
              <strong>Payments</strong> — handled by our payment processors (such as Stripe, Apple and Google). We
              don&apos;t store full card numbers.
            </li>
            <li>
              <strong>Website analytics</strong> — standard usage data (pages visited, device and browser type,
              approximate location) collected through cookies and analytics tools such as Google Analytics.
            </li>
          </ul>
        </Section>

        <Section title="How we use it">
          <ul className="list-disc pl-6 space-y-2">
            <li>To respond to you, prepare estimates, schedule and deliver services, and run tournaments in RackerTracker.</li>
            <li>
              To send service messages you&apos;d expect — quote updates, appointment and order reminders, tournament
              and match alerts — by email, SMS or WhatsApp.
            </li>
            <li>To process payments, keep business records, and meet legal and tax obligations.</li>
            <li>To keep our services secure and improve them.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your personal information, and we don&apos;t use it for third-party
            advertising.
          </p>
        </Section>

        <Section title="WhatsApp">
          <p>
            If you message us on WhatsApp, or opt in to WhatsApp updates, we receive your WhatsApp phone number,
            profile name and the messages and media you send, through Meta&apos;s WhatsApp Business Platform. We use
            them only to reply to you and send the updates you asked for. You can stop WhatsApp updates at any time
            by replying <strong>STOP</strong>. WhatsApp&apos;s own handling of your data is covered by{" "}
            <a href="https://www.whatsapp.com/legal/privacy-policy" className="text-brand underline hover:text-brandDark">
              WhatsApp&apos;s privacy policy
            </a>
            .
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>
            Only service providers that help us run the business — for example hosting and databases, email and
            messaging (including Meta/WhatsApp and our phone provider), payment processors, cloud storage and
            analytics — and only as needed to provide their service. We may also disclose information if required by
            law or to protect our rights and safety.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            As long as needed for the purpose we collected it, then as required for business, tax or legal records.
            You can ask us to delete your information sooner unless we&apos;re required to keep it.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can ask to see, correct or delete your information, or to stop receiving messages, by emailing us.
            RackerTracker users can also delete their account from within the app or by contacting us.
          </p>
        </Section>

        <Section title="Children">
          <p>Our services aren&apos;t directed to children under 13, and we don&apos;t knowingly collect their information.</p>
        </Section>

        <Section title="Changes">
          <p>We may update this policy; the effective date above will change when we do.</p>
        </Section>

        <Section title="Contact">
          <p>
            The Hearth &amp; Hollow LLC · Salisbury, North Carolina
            <br />
            Email:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline hover:text-brandDark">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>
      </main>

      {/* Footer */}
      <footer className="bg-amber-50 border-t border-brand mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-brandDark">
          <p>
            &copy; 2026 {companyName}. All rights reserved. ·{" "}
            <Link href="/privacy" className="underline hover:text-brand">Privacy Policy</Link>
          </p>
          <p className="text-sm text-themeMuted mt-2">Crafted for Self-Sufficiency • Built to Last</p>
        </div>
      </footer>
    </div>
  );
}
