import DOMPurify from "isomorphic-dompurify";

const SANITIZE = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "a",
    "span",
    "blockquote",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class"],
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitize HTML from the admin rich-text editor before save or display.
 */
export function sanitizeAdminRichHtml(dirty: string): string {
  return String(DOMPurify.sanitize(dirty, SANITIZE));
}
