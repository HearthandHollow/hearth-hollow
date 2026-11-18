import { countFestivalFreaksHit, festivalFreaksVersionJson } from "@/lib/festival-freaks-releases";

// The game's update check reads this on startup. Keep the cache short so
// Cloudflare and browsers pick up a new release within a few minutes.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // The game may send ?build=N so we can see which builds are out there.
  const build = new URL(req.url).searchParams.get("build");
  countFestivalFreaksHit(build && /^\d{1,4}$/.test(build) ? `version_check_b${build}` : "version_check");
  return new Response(JSON.stringify(festivalFreaksVersionJson(), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
