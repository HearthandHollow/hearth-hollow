import { Suspense } from "react";
import PlaneFinderClient from "./PlaneFinderClient";

export default function PlaneFinderPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-6 py-16 text-slate-400">
          Loading Plane Finder…
        </main>
      }
    >
      <PlaneFinderClient />
    </Suspense>
  );
}
