import { randoma11y } from "randoma11y";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function shiftHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return (
    "#" +
    [clamp(r + amount), clamp(g + amount), clamp(b + amount)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

function applyScheme() {
  const { colors } = randoma11y();
  const [a, b] = colors;
  const bg = luminance(a) >= luminance(b) ? a : b;
  const ink = luminance(a) >= luminance(b) ? b : a;
  const [r, g, i] = hexToRgb(ink);
  const html = document.documentElement;
  html.style.setProperty("--bg", bg);
  html.style.setProperty("--bg-muted", shiftHex(bg, -15));
  html.style.setProperty("--cream", bg);
  html.style.setProperty("--ink", ink);
  html.style.setProperty("--ink-deep", shiftHex(ink, -30));
  html.style.setProperty("--ink-bright", shiftHex(ink, 30));
  html.style.setProperty("--divider", `rgba(${r},${g},${i},0.2)`);
  html.style.setProperty("--footer-link", `rgba(${hexToRgb(bg).join(",")},0.62)`);
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("tbc-color-shuffle");
  if (!btn) return;
  btn.addEventListener("mouseenter", () => { (btn as HTMLElement).style.opacity = "1"; });
  btn.addEventListener("mouseleave", () => { (btn as HTMLElement).style.opacity = "0.5"; });
  btn.addEventListener("click", applyScheme);
});
