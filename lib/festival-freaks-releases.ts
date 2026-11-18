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
