/**
 * Build URL slug from Latin letters/numbers in title (Bangla-only titles yield "").
 */
export function slugifyLatinFromTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
