/**
 * Resolve the public base URL for building absolute links/redirects.
 * Prefers the configured custom domain, then the Vercel deployment URL,
 * then localhost for local development.
 */
export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3001")
  );
}
