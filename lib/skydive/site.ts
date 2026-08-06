/**
 * Base URL for the Skydive Weather micro-site. Emailed links must point at the
 * subdomain (skydive-weather.thehearthhollow.com), where middleware rewrites
 * paths onto the /skydive/* pages of this app.
 */
export function getSkydiveBaseUrl(): string {
  return (
    process.env.SKYDIVE_SITE_URL ||
    (process.env.NEXT_PUBLIC_SITE_URL
      ? "https://skydive-weather.thehearthhollow.com"
      : "http://localhost:3001/skydive")
  );
}
