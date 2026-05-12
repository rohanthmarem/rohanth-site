import { randoma11y } from "randoma11y";

const STORAGE_KEY = "tbc-color-scheme";

type ColorScheme = {
  bg: string;
  bgMuted: string;
  cream: string;
  ink: string;
  inkDeep: string;
  inkBright: string;
  divider: string;
  footerLink: string;
};

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

function setScheme(scheme: ColorScheme) {
  const html = document.documentElement;
  html.style.setProperty("--bg", scheme.bg);
  html.style.setProperty("--bg-muted", scheme.bgMuted);
  html.style.setProperty("--cream", scheme.cream);
  html.style.setProperty("--ink", scheme.ink);
  html.style.setProperty("--ink-deep", scheme.inkDeep);
  html.style.setProperty("--ink-bright", scheme.inkBright);
  html.style.setProperty("--divider", scheme.divider);
  html.style.setProperty("--footer-link", scheme.footerLink);
}

function makeScheme(): ColorScheme {
  const { colors } = randoma11y();
  const [a, b] = colors;
  const bg = luminance(a) >= luminance(b) ? a : b;
  const ink = luminance(a) >= luminance(b) ? b : a;
  const [r, g, i] = hexToRgb(ink);
  return {
    bg,
    bgMuted: shiftHex(bg, -15),
    cream: bg,
    ink,
    inkDeep: shiftHex(ink, -30),
    inkBright: shiftHex(ink, 30),
    divider: `rgba(${r},${g},${i},0.2)`,
    footerLink: `rgba(${hexToRgb(bg).join(",")},0.62)`,
  };
}

function getNavigationType() {
  return performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
}

function restoreScheme() {
  if (getNavigationType()?.type === "reload") {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    setScheme(JSON.parse(saved) as ColorScheme);
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

function applyScheme() {
  const scheme = makeScheme();
  setScheme(scheme);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(scheme));
}

document.addEventListener("DOMContentLoaded", () => {
  restoreScheme();
  const btn = document.getElementById("tbc-color-shuffle");
  if (!btn) return;
  btn.addEventListener("mouseenter", () => { (btn as HTMLElement).style.opacity = "1"; });
  btn.addEventListener("mouseleave", () => { (btn as HTMLElement).style.opacity = "0.5"; });
  btn.addEventListener("click", applyScheme);
});
