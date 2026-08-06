import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export default function SkydiveDashboardPage() {
  // useSearchParams (for the ?u=&t= magic-link credentials) requires a
  // Suspense boundary around the client component.
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-6 py-16 text-slate-400">
          Loading your dashboard…
        </main>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
