import { Suspense } from "react";
import DayDetailClient from "./DayDetailClient";

export default function SkydiveDayPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-6 py-16 text-slate-400">
          Loading the day&apos;s details…
        </main>
      }
    >
      <DayDetailClient />
    </Suspense>
  );
}
