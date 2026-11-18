import { festivalFreaksVersionJson } from "@/lib/festival-freaks-releases";

// The game's update check reads this on startup. Keep the cache short so
// Cloudflare and browsers pick up a new release within a few minutes.
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(JSON.stringify(festivalFreaksVersionJson(), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
