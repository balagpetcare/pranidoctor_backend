/**
 * Absolute origin for links returned to mobile clients (`profilePhotoUrl`, upload redirects).
 * Prefer `NEXT_PUBLIC_APP_URL` / `APP_URL` so images stay consistent across environments.
 */
export function publicMobileAssetBaseUrl(request: Request): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}
