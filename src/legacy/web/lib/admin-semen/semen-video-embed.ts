export type VideoEmbedInfo =
  | { provider: "youtube"; id: string }
  | { provider: "vimeo"; id: string };

export function parseVideoEmbedUrl(raw: string): VideoEmbedInfo | null {
  const t = raw.trim();
  if (!t) return null;
  if (typeof URL === "undefined" || !URL.canParse(t)) return null;

  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./i, "").toLowerCase();

  if (host === "youtu.be") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    if (id && /^[\w-]{6,}$/.test(id)) return { provider: "youtube", id };
    return null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      if (id && /^[\w-]{6,}$/.test(id)) return { provider: "youtube", id };
    }
    if (u.pathname.startsWith("/embed/")) {
      const id = u.pathname.split("/")[2];
      if (id && /^[\w-]{6,}$/.test(id)) return { provider: "youtube", id };
    }
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/")[2];
      if (id && /^[\w-]{6,}$/.test(id)) return { provider: "youtube", id };
    }
    return null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts[parts.length - 1];
    if (id && /^\d+$/.test(id)) return { provider: "vimeo", id };
  }

  return null;
}

export function videoEmbedIframeSrc(info: VideoEmbedInfo): string {
  if (info.provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(info.id)}`;
  }
  return `https://player.vimeo.com/video/${encodeURIComponent(info.id)}`;
}
