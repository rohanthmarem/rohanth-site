/** 09.25.26 — the site-wide date format. Dates are UTC midnights from frontmatter. */
export function fmtDot(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(2);
  return `${mm}.${dd}.${yy}`;
}

/** Minutes to read at ~230 wpm, from the raw markdown body. */
export function readingTime(body = ""): number {
  const words = body.replace(/```[\s\S]*?```/g, "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

export function wordCount(body = ""): number {
  return body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
}
