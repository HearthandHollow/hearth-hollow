// Festival Freaks release history: the single source of truth for both the
// /festivalfreaks download page and /festivalfreaks/version.json (which the
// game polls on startup). Add new releases at the TOP; the first entry is
// "latest". `build` is the integer the game compares, so it must only go up.
export type FestivalFreaksRelease = {
  build: number;
  version: string;
  released: string; // YYYY-MM-DD
  size: string;
  download: string;
  notes: string[];
};

export const FESTIVAL_FREAKS_PAGE = "https://thehearthhollow.com/festivalfreaks";

export const FESTIVAL_FREAKS_RELEASES: FestivalFreaksRelease[] = [
  {
    build: 6,
    version: "0.6.0",
    released: "2026-11-18",
    size: "3.19 GB",
    download: "https://drive.google.com/file/d/1n2r4_541YDFRJiDOdGnbH6QjzW5-rm1o/view",
    notes: [
      "The garage: do up the RV, private jet or UFO (paint, livery, wheels, four interiors, extras)",
      "A rebuilt RV and jet, and a real UFO with a ramp and a mothership inside",
      "Proper planets in the sky",
      "Hats sized to each head",
      "A working mirror",
      "Crew and vendors no longer stand with their arms out",
      "Treat effects keep going in the golf cart",
      "Build menu sections, 598 acts, 45° rotation, eating and drinking, major events, varied gravity",
    ],
  },
  {
    build: 4,
    version: "0.4.0",
    released: "2026-11-17",
    size: "3.2 GB",
    download: "https://drive.google.com/file/d/1n2r4_541YDFRJiDOdGnbH6QjzW5-rm1o/view?usp=sharing",
    notes: [
      "Off-world crowds: aliens, plus Paragon monsters and robots in the crowd and on stage",
      "Real festival kit: portable toilets, band instruments, beer gardens, film lights, a moon base around off-world venues",
      "Fix: opening the RV to friends (and joining) no longer crashes the game",
    ],
  },
];

export const latestFestivalFreaksRelease = FESTIVAL_FREAKS_RELEASES[0];

export function festivalFreaksVersionJson() {
  const r = latestFestivalFreaksRelease;
  return {
    build: r.build,
    version: r.version,
    released: r.released,
    size: r.size,
    download: r.download,
    page: FESTIVAL_FREAKS_PAGE,
    notes: r.notes,
  };
}

// Bump today's counter for one kind of hit. Fire-and-forget: a counting
// failure must never break the page, the download or the game's update check.
export function countFestivalFreaksHit(kind: string) {
  if (!process.env.DATABASE_URL) return;
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  import("@/lib/prisma")
    .then(({ prisma }) =>
      prisma.festivalFreaksStat.upsert({
        where: { day_kind: { day, kind } },
        create: { day, kind, count: 1 },
        update: { count: { increment: 1 } },
      }),
    )
    .catch(() => {});
}
