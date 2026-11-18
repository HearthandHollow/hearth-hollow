import { countFestivalFreaksHit, latestFestivalFreaksRelease } from "@/lib/festival-freaks-releases";

// The page's Download button goes through here so clicks get counted, then
// sends the browser on to the Google Drive file for the latest build.
export const dynamic = "force-dynamic";

export async function GET() {
  countFestivalFreaksHit("download_click");
  return new Response(null, {
    status: 302,
    headers: { Location: latestFestivalFreaksRelease.download, "Cache-Control": "no-store" },
  });
}
