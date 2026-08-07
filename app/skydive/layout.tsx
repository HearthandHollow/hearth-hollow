import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Skydive Weather — Go / No-Go Forecast",
  description:
    "Automatic skydiving go/no-go calls from National Weather Service forecasts, checked against your personal wind, cloud, and weather limits.",
};

export default function SkydiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Standalone dark "sky" look for the micro-site — deliberately not using the
  // Hearth & Hollow theme tokens, since this brand lives on its own subdomain.
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-950 via-slate-950 to-slate-950 text-slate-100">
      {children}
    </div>
  );
}
