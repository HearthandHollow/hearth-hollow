"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Fallback images mirror the ThemeSettings defaults in prisma/schema.prisma —
// used only until the theme settings load (or if that fetch fails), so the
// homepage never looks broken.
const DEFAULT_IMAGES = {
  heroImageUrl:
    "https://images.unsplash.com/photo-1757605327126-9baefea3348b?auto=format&fit=crop&w=1600&q=80",
  craftImageUrl:
    "https://images.unsplash.com/photo-1631396326646-c06a935ff3a6?auto=format&fit=crop&w=1200&q=80",
  gatheringImageUrl:
    "https://images.unsplash.com/photo-1746701905946-f1babf656914?auto=format&fit=crop&w=1200&q=80",
  homesteadImageUrl:
    "https://images.unsplash.com/photo-1771425890623-f17451025495?auto=format&fit=crop&w=1200&q=80",
};

export default function Home() {
  const [images, setImages] = useState(DEFAULT_IMAGES);

  useEffect(() => {
    fetch("/api/theme")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setImages({
          heroImageUrl: data.heroImageUrl || DEFAULT_IMAGES.heroImageUrl,
          craftImageUrl: data.craftImageUrl || DEFAULT_IMAGES.craftImageUrl,
          gatheringImageUrl: data.gatheringImageUrl || DEFAULT_IMAGES.gatheringImageUrl,
          homesteadImageUrl: data.homesteadImageUrl || DEFAULT_IMAGES.homesteadImageUrl,
        });
      })
      .catch(() => {
        // Keep defaults on failure — never block rendering on this fetch.
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-themeBorder sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between sm:items-center">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-brand break-words">
              {process.env.NEXT_PUBLIC_COMPANY_NAME || "The Hearth & Hollow"}
            </h1>
            <p className="text-xs sm:text-sm text-themeMuted">Crafted for Self-Sufficiency • Built to Last</p>
          </div>
          <nav className="flex flex-wrap gap-2 sm:gap-4 items-center">
            <Link href="/gallery" className="px-3 sm:px-4 py-2 text-sm sm:text-base text-themeMuted hover:text-themeText">
              Our Work
            </Link>
            <Link href="/request" className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-brand text-white rounded-lg hover:bg-brandDark">
              Request Quote
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — full-bleed image with overlaid headline */}
      <section className="relative">
        <div className="relative h-[60vh] min-h-[420px] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images.heroImageUrl}
            alt="A warm, hand-built home — the hearth at the heart of The Hearth & Hollow"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
          <div className="relative h-full max-w-6xl mx-auto px-4 flex flex-col items-start justify-center text-left">
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-white drop-shadow-lg max-w-2xl">
              Welcome to The Hearth &amp; Hollow
            </h2>
            <p className="text-base sm:text-lg text-white/90 mb-8 max-w-xl drop-shadow">
              We help you build a self-sufficient life through skilled craftsmanship. From handyman repairs to custom woodworking and metal fabrication — tell us about your project, upload photos, and we'll send you a professional estimate within 24 hours.
            </p>
            <Link
              href="/request"
              className="inline-block px-6 py-3 bg-brand text-white rounded-lg hover:bg-brandDark text-lg shadow-lg"
            >
              Start Your Request →
            </Link>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:py-12 w-full">
        {/* Services */}
        <div className="bg-amber-50 border border-brand rounded-lg p-5 sm:p-8 mb-12">
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

        {/* Hand-crafted — image + text */}
        <div className="grid md:grid-cols-2 gap-6 sm:gap-10 items-center my-12">
          <div className="order-2 md:order-1">
            <h3 className="text-2xl font-bold text-brandDark mb-3">Hand-Crafted, Built to Last</h3>
            <p className="text-themeMuted mb-3">
              Every project starts at the workbench. We believe in real materials, real joinery, and the kind of attention that only comes from working with your hands — not shortcuts that fail in a few seasons.
            </p>
            <p className="text-themeMuted">
              Whether it's a custom-built piece of furniture or a structural repair, the craft is the point, not just the outcome.
            </p>
          </div>
          <div className="order-1 md:order-2 rounded-lg overflow-hidden border border-themeBorder shadow-sm h-64 sm:h-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images.craftImageUrl}
              alt="Hand-crafted woodworking in progress"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* The Hollow — gathering image + text */}
        <div className="grid md:grid-cols-2 gap-6 sm:gap-10 items-center my-12">
          <div className="rounded-lg overflow-hidden border border-themeBorder shadow-sm h-64 sm:h-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images.gatheringImageUrl}
              alt="A warm, rustic gathering space"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-brandDark mb-3">The Hollow — A Place to Gather</h3>
            <p className="text-themeMuted mb-3">
              A hearth is the heart of a home. A hollow is the large, open space carved out for gathering — family, friends, and community coming together under one roof.
            </p>
            <p className="text-themeMuted">
              We build the spaces that hold both: warm, durable, and made for the people who'll fill them.
            </p>
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

        {/* Homestead lifestyle — image + About */}
        <div className="bg-themeBg border border-themeBorder rounded-lg overflow-hidden my-12">
          <div className="h-56 sm:h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images.homesteadImageUrl}
              alt="A peek into the homesteading lifestyle"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-5 sm:p-8">
            <h3 className="text-2xl font-bold text-themeText mb-4">About The Hearth & Hollow</h3>
            <p className="text-themeMuted mb-4">
              We're a team of skilled craftspeople dedicated to helping you build a self-sufficient, thriving homestead. Our mission is to combine ancient craft wisdom with modern expertise to create structures and solutions that last generations.
            </p>
            <p className="text-themeMuted">
              Whether you need a quick repair, a custom build, or infrastructure for your homestead, we approach every project with intention, quality, and deep respect for the craft. Every nail, every joint, every weld is an investment in your independence and prosperity.
            </p>
          </div>
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
