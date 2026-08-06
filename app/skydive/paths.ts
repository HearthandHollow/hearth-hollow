/**
 * The skydive pages are reachable two ways: as /skydive/* on the main domain
 * and as /* on skydive-weather.thehearthhollow.com (middleware rewrite).
 * Internal links must match whichever host the visitor is on.
 */
export function skydivePath(path: string): string {
  const onSubdomain =
    typeof window !== "undefined" &&
    window.location.host.toLowerCase().startsWith("skydive-weather.");
  if (onSubdomain) return path;
  return path === "/" ? "/skydive" : `/skydive${path}`;
}
