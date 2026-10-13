// Site-wide behaviour, bundled once and shared by every page (~2KB).
//   mark.hl                 highlight sweeps in when scrolled into view
//   [data-scramble-in]      text resolves left→right behind a few scrambled glyphs, once, in view
//   [data-scramble-hover]   a scramble wave passes over the text on hover (from the old site)
//   [data-theme-toggle]     light/dark, remembered
//   [data-accent-shuffle]   ✦ picks a new accent hue, remembered (shift-click resets)

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;

function inView(els: Iterable<Element>, fn: (el: Element) => void, threshold = 0.6) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); }
    },
    { threshold },
  );
  for (const el of els) io.observe(el);
}

/* ── highlights ─────────────────────────────────────────────── */
const marks = document.querySelectorAll<HTMLElement>("mark.hl");
if (reduce) marks.forEach((m) => m.classList.add("is-on"));
else {
  marks.forEach((m) => {
    if (m.dataset.trigger === "hover") {
      m.addEventListener("pointerenter", () => m.classList.add("is-on"));
      m.addEventListener("pointerleave", () => m.classList.remove("is-on"));
    } else if (m.dataset.trigger === "auto") requestAnimationFrame(() => m.classList.add("is-on"));
  });
  inView([...marks].filter((m) => !m.dataset.trigger || m.dataset.trigger === "inView"), (m) => m.classList.add("is-on"), 0.9);
}

/* ── scramble in ────────────────────────────────────────────── */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+";
function scrambleIn(el: HTMLElement, speed = 34, count = 6) {
  const text = el.dataset.text ?? (el.dataset.text = el.textContent ?? "");
  const done = document.createTextNode("");
  const pending = document.createElement("span");
  pending.className = "scr-pending";
  pending.setAttribute("aria-hidden", "true");
  el.replaceChildren(done, pending);
  let i = 0;
  const t = setInterval(() => {
    done.nodeValue = text.slice(0, i);
    let s = "";
    for (let k = 0; k < Math.min(count, text.length - i); k++) s += text[i + k] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    pending.textContent = s;
    if (++i > text.length) { clearInterval(t); el.textContent = text; }
  }, speed);
}
const scrIn = document.querySelectorAll<HTMLElement>("[data-scramble-in]");
if (!reduce) {
  scrIn.forEach((el) => {
    el.setAttribute("aria-label", el.textContent ?? "");
    el.style.minWidth = `${el.getBoundingClientRect().width}px`;
    el.style.visibility = "hidden";
  });
  inView(scrIn, (el) => {
    const h = el as HTMLElement;
    setTimeout(() => { h.style.visibility = ""; scrambleIn(h); }, Number(h.dataset.scrambleDelay || 0));
  }, 0.4);
}

/* ── scramble wave on hover ─────────────────────────────────── */
const WAVE = "!#%&*+<=>?@[]^_|~\\/{}";
document.querySelectorAll<HTMLElement>("[data-scramble-hover]").forEach((el) => {
  const target = (el.querySelector(".u") as HTMLElement) || el;
  const orig = target.textContent ?? "";
  let timer = 0;
  const restore = () => { clearInterval(timer); target.textContent = orig; };
  el.addEventListener("pointerenter", () => {
    if (reduce) return;
    clearInterval(timer);
    let tick = 0;
    timer = window.setInterval(() => {
      const wave = tick++ * 1.1;
      if (wave > orig.length + 3) return restore();
      target.textContent = [...orig].map((ch, i) => (ch === " " || Math.abs(i - wave) >= 2.2 ? ch : WAVE[(Math.random() * WAVE.length) | 0])).join("");
    }, 40);
  });
  el.addEventListener("pointerleave", restore);
});

/* ── theme + accent ─────────────────────────────────────────── */
function syncThemeLabel() {
  const dark = root.dataset.theme === "dark";
  document.querySelectorAll("[data-theme-label]").forEach((n) => (n.textContent = dark ? "light" : "dark"));
}
syncThemeLabel();
document.querySelectorAll("[data-theme-toggle]").forEach((b) =>
  b.addEventListener("click", () => {
    const dark = root.dataset.theme !== "dark";
    if (dark) root.dataset.theme = "dark"; else delete root.dataset.theme;
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
    applyAccent();
    syncThemeLabel();
    document.dispatchEvent(new CustomEvent("theme-change"));
  }),
);

// Accent is stored as a hue; lightness/chroma depend on the theme so it always reads on paper.
function accentFor(h: number) {
  return root.dataset.theme === "dark" ? `oklch(0.72 0.17 ${h})` : `oklch(0.5 0.24 ${h})`;
}
function applyAccent() {
  let h: string | null = null;
  try { h = localStorage.getItem("accent-h"); } catch {}
  if (h) root.style.setProperty("--accent", accentFor(Number(h)));
  else root.style.removeProperty("--accent");
}
document.querySelectorAll("[data-accent-shuffle]").forEach((b) =>
  b.addEventListener("click", (e) => {
    try {
      if ((e as MouseEvent).shiftKey) localStorage.removeItem("accent-h");
      else localStorage.setItem("accent-h", String(Math.round(Math.random() * 360)));
    } catch {}
    applyAccent();
  }),
);
