/**
 * Prevent open redirects: only same-origin relative paths under `/admin` are allowed.
 */
export function getSafeAdminNextPath(next: string | null | undefined): string {
  if (
    next &&
    next.startsWith("/admin") &&
    !next.startsWith("//") &&
    !next.includes("://") &&
    !next.includes("\\")
  ) {
    return next;
  }
  return "/admin";
}
