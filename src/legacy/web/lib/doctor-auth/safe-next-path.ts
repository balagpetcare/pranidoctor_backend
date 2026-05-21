/**
 * Prevent open redirects: only same-origin relative paths under `/doctor` are allowed.
 */
export function getSafeDoctorNextPath(next: string | null | undefined): string {
  if (
    next &&
    next.startsWith("/doctor") &&
    !next.startsWith("//") &&
    !next.includes("://") &&
    !next.includes("\\")
  ) {
    return next;
  }
  return "/doctor";
}
