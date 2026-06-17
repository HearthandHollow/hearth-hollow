"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-themeBorder sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand">
              {process.env.NEXT_PUBLIC_COMPANY_NAME || "The Hearth & Hollow"}
            </h1>
            <p className="text-sm text-themeMuted">Crafted for Self-Sufficiency • Built to Last</p>
          </div>
          <nav className="flex gap-4">
            <Link href="/request" className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brandDark">
              Request Quote
            </Link>
            <Link href="/admin" className="px-4 py-2 text-themeMuted hover:text-themeText">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-12 w-full">
        <div className="text-center py-12">
          <h2 className="text-4xl font-bold mb-4 text-brandDark">Welcome to The Hearth & Hollow</h2>
          <p className="text-lg text-themeMuted mb-8">
            We help you build a self-sufficient life through skilled craftsmanship. From handyman repairs to custom woodworking and metal fabrication — tell us about your project, upload photos, and we'll send you a professional estimate within 24 hours.
          </p>
          <Link 
            href="/request" 
            className="inline-block px-6 py-3 bg-brand text-white rounded-lg hover:bg-brandDark text-lg"
          >
            Start Your Request →
          </Link>
        </div>

        {/* Services */}
        <div className="bg-amber-50 border border-brand rounded-lg p-8 mb-12">
          <h3 className="text-2xl font-bold text-brandDark mb-4">Our Services</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold text-brandDark mb-2">🔨 Handyman & Repairs</h4>
              <p className="text-themeMuted text-sm">General repairs, installations, and maintenance for your home or homestead. From fixing doors to building systems — we handle it all with care.</p>
            </div>
            <div>
              <h4 className="font-semibold text-brandDark mb-2">🪵 Carpentry & Woodworking</h4>
              <p className="text-themeMuted text-sm">Custom woodwork, decks, fencing, furniture, and structural repairs. We craft quality pieces built to endure and serve your self-sufficient lifestyle.</p>
            </div>
            <div>
              <h4 className="font-semibold text-brandDark mb-2">⚙️ Metal Fabrication</h4>
              <p className="text-themeMuted text-sm">Custom welding, gates, railings, and metal structures. Expert metalwork for both residential projects and homestead infrastructure.</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 my-12">
          <div className="bg-white p-6 rounded-lg border border-themeBorder">
            <div className="text-3xl mb-2">📸</div>
            <h3 className="text-lg font-semibold mb-2">Upload Photos</h3>
            <p className="text-themeMuted">Share clear photos and detailed descriptions of your project</p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-themeBorder">
            <div className="text-3xl mb-2">🤖</div>
            <h3 className="text-lg font-semibold mb-2">AI Analysis</h3>
            <p className="text-themeMuted">We use advanced AI to analyze your project for scope and materials</p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-themeBorder">
            <div className="text-3xl mb-2">✅</div>
            <h3 className="text-lg font-semibold mb-2">Quick Response</h3>
            <p className="text-themeMuted">Professional estimate within 24 hours</p>
          </div>
        </div>

        {/* About */}
        <div className="bg-themeBg border border-themeBorder rounded-lg p-8 my-12">
          <h3 className="text-2xl font-bold text-themeText mb-4">About The Hearth & Hollow</h3>
          <p className="text-themeMuted mb-4">
            We're a team of skilled craftspeople dedicated to helping you build a self-sufficient, thriving homestead. Our mission is to combine ancient craft wisdom with modern expertise to create structures and solutions that last generations.
          </p>
          <p className="text-themeMuted">
            Whether you need a quick repair, a custom build, or infrastructure for your homestead, we approach every project with intention, quality, and deep respect for the craft. Every nail, every joint, every weld is an investment in your independence and prosperity.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-amber-50 border-t border-brand mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-brandDark">
          <p>&copy; 2026 {process.env.NEXT_PUBLIC_COMPANY_NAME || "The Hearth & Hollow"}. All rights reserved.</p>
          <p className="text-sm text-themeMuted mt-2">Crafted for Self-Sufficiency • Built to Last</p>
        </div>
      </footer>
    </div>
  );
}
