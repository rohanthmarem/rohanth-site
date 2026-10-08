import { THOUGHTS_TIME_ZONE } from "./content.schemas";

export function fmtThoughtDate(d: Date) {
  const day = d.toLocaleDateString("en-US", { timeZone: THOUGHTS_TIME_ZONE, month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone: THOUGHTS_TIME_ZONE, hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

/** Plain-text excerpt of a note's markdown, for <title> and meta descriptions. */
export function excerpt(markdown: string, length: number) {
  const plain = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > length ? `${plain.slice(0, length - 1).trimEnd()}…` : plain;
}
